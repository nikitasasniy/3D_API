
import os
from neo4j import GraphDatabase, Transaction
from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Разрешаем все источники (или укажите конкретные)
    allow_credentials=True,
    allow_methods=["*"],  # Разрешаем все методы (GET, POST и т. д.)
    allow_headers=["*"],  # Разрешаем все заголовки
)



# Load environment variables from a .env file
load_dotenv()

# FastAPI app and database initialization
DB_URI = os.getenv("DB_URI", "bolt://localhost:7687")
DB_USERNAME = os.getenv("DB_USERNAME", "neo4j")
DB_PASSWORD = os.getenv("DB_PASSWORD", "neo4jpassword")
API_TOKEN = os.getenv("API_TOKEN", "MY_TOKEN")

class Neo4jQueries:
    def __init__(self, uri, user, password):
        self.driver = GraphDatabase.driver(uri, auth=(user, password))

    def close(self):
        """Close the connection to the Neo4j database."""
        self.driver.close()

    def get_all_nodes(self):
        """Get all nodes from the database."""
        query = "MATCH (n) RETURN n.id AS id, labels(n) AS label"
        with self.driver.session() as session:
            result = session.run(query)
            return [{"id": record["id"], "label": record["label"][0]} for record in result]

    def get_node_with_relationships(self, node_id):
        """Get a node and its relationships by node ID."""
        query = """
        MATCH (n)-[r]-(m)
        WHERE n.id = $id
        RETURN n AS node, r AS relationship, m AS target_node
        """
        with self.driver.session() as session:
            result = session.run(query, id=node_id)
            nodes = [
                {
                    "node": {
                        "id": record["node"].element_id,
                        "label": record["node"].labels,
                        "attributes": dict(record["node"]),
                    },
                    "relationship": {
                        "type": record["relationship"].type,
                        "attributes": dict(record["relationship"]),
                    },
                    "target_node": {
                        "id": record["target_node"].element_id,
                        "label": record["target_node"].labels,
                        "attributes": dict(record["target_node"]),
                    },
                }
                for record in result
            ]
            return nodes

    def add_node_and_relationships(self, label, properties, relationships):
        """Add a node and relationships to the database."""
        with self.driver.session() as session:
            session.execute_write(self._create_node_and_relationships, label, properties, relationships)

    @staticmethod
    def _create_node_and_relationships(tx: Transaction, label, properties, relationships):
        """Create a node and its relationships inside a transaction."""
        create_node_query = f"CREATE (n:{label} $properties) RETURN n"
        node = tx.run(create_node_query, properties=properties).single()["n"]
        node_id = node.element_id

        for relationship in relationships:
            tx.run(""" 
                MATCH (n), (m)
                WHERE n.id = $node_id AND m.id = $target_id
                CREATE (n)-[r:RELATIONSHIP_TYPE]->(m)
                SET r = $relationship_attributes
            """, node_id=node_id, target_id=relationship['target_id'],
                relationship_attributes=relationship['attributes'])

    def delete_node(self, node_id):
        """Delete a node by its ID."""
        with self.driver.session() as session:
            session.execute_write(self._delete_node, node_id)

    @staticmethod
    def _delete_node(tx: Transaction, node_id):
        """Delete a node and its relationships inside a transaction."""
        tx.run("MATCH (n) WHERE n.id = $id DETACH DELETE n", id=node_id)

# FastAPI and OAuth2 for security
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# Token validation
def get_current_token(token: str = Depends(oauth2_scheme)):
    if token != API_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token {token}",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return token

# Context manager for FastAPI to handle database connection lifecycle
@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.db = Neo4jQueries(DB_URI, DB_USERNAME, DB_PASSWORD)
    yield
    app.state.db.close()

app = FastAPI(lifespan=lifespan)

# Pydantic model for request validation
class Node(BaseModel):
    label: str
    properties: dict
    relationships: list

# Routes for Neo4j interactions
@app.get("/nodes")
async def get_all_nodes():
    nodes = app.state.db.get_all_nodes()
    return nodes

@app.get("/nodes/{id}")
async def get_node(id: int):
    node = app.state.db.get_node_with_relationships(id)
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    return node

@app.post("/nodes", dependencies=[Depends(get_current_token)])
async def add_node(node: Node):
    app.state.db.add_node_and_relationships(node.label, node.properties, node.relationships)
    return {"message": "Node and relationships added successfully"}

@app.delete("/nodes/{id}", dependencies=[Depends(get_current_token)])
async def delete_node(id: int):
    app.state.db.delete_node(id)
    return {"message": "Node and relationships deleted successfully"}

@app.get("/nodes/{id}/relationships")
async def get_node_relationships(id: int):
    node_with_relationships = app.state.db.get_node_with_relationships(id)
    if not node_with_relationships:
        raise HTTPException(status_code=404, detail="Node not found")
    return node_with_relationships

@app.get("/nodes/graph")
async def get_graph():
    # Получаем все узлы и их связи
    nodes_data = app.state.db.get_all_nodes()
    graph_data = []

    # Для каждого узла получаем его связи
    for node in nodes_data:
        relationships = app.state.db.get_node_with_relationships(node["id"])
        graph_data.append({
            "node": node,
            "relationships": relationships
        })

    return graph_data

