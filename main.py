import os
from neo4j import AsyncGraphDatabase
from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from fastapi.responses import JSONResponse

# Загрузка переменных окружения
load_dotenv()

# Переменные окружения для подключения к базе данных
DB_URI = os.getenv("DB_URI", "bolt://localhost:7687")
DB_USERNAME = os.getenv("DB_USERNAME", "neo4j")
DB_PASSWORD = os.getenv("DB_PASSWORD", "neo4jpassword")
API_TOKEN = os.getenv("API_TOKEN", "MY_TOKEN")

# Инициализация FastAPI
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# Контекстный менеджер для работы с базой данных
@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.db = Neo4jQueries(DB_URI, DB_USERNAME, DB_PASSWORD)
    yield
    await app.state.db.close()


app = FastAPI(lifespan=lifespan)


# Класс для работы с запросами к базе данных Neo4j
class Neo4jQueries:
    def __init__(self, uri, user, password):
        self.driver = AsyncGraphDatabase.driver(uri, auth=(user, password))

    async def close(self):
        """Закрыть соединение с базой данных."""
        await self.driver.close()

    async def get_all_nodes(self):
        """Получить все узлы из базы данных."""
        query = "MATCH (n) RETURN n.id AS id, labels(n) AS label"
        async with self.driver.session() as session:
            result = await session.run(query)
            result_list = []
            async for record in result:
                result_list.append({"id": record["id"], "label": record["label"][0]})
            return result_list

    async def get_node_with_relationships(self, node_id):
        """Получить узел и его связи по ID."""
        query = """
        MATCH (n)-[r]-(m)
        WHERE n.id = $id
        RETURN n AS node, r AS relationship, m AS target_node
        """
        async with self.driver.session() as session:
            result = await session.run(query, id=node_id)
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

    async def add_node_and_relationships(self, label, properties, relationships):
        """Добавить узел и связи в базу данных."""
        async with self.driver.session() as session:
            await session.write_transaction(self._create_node_and_relationships, label, properties, relationships)

    @staticmethod
    async def _create_node_and_relationships(tx, label, properties, relationships):
        """Создать узел и его связи в рамках транзакции."""
        create_node_query = f"CREATE (n:{label} $properties) RETURN n"
        node = await tx.run(create_node_query, properties=properties).single()["n"]
        node_id = node.element_id

        for relationship in relationships:
            await tx.run(""" 
                MATCH (n), (m)
                WHERE n.id = $node_id AND m.id = $target_id
                CREATE (n)-[r:RELATIONSHIP_TYPE]->(m)
                SET r = $relationship_attributes
            """, node_id=node_id, target_id=relationship['target_id'],
                       relationship_attributes=relationship['attributes'])

    async def delete_node(self, node_id):
        """Удалить узел по его ID."""
        async with self.driver.session() as session:
            await session.write_transaction(self._delete_node, node_id)

    @staticmethod
    async def _delete_node(tx, node_id):
        """Удалить узел и его связи в рамках транзакции."""
        await tx.run("MATCH (n) WHERE n.id = $id DETACH DELETE n", id=node_id)


# Проверка токена
def get_current_token(token: str = Depends(oauth2_scheme)):
    if token != API_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token {token}",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return token


# Pydantic модель для валидации запросов
class Node(BaseModel):
    label: str
    properties: dict
    relationships: list


# Роуты для взаимодействия с Neo4j
@app.get("/nodes")
async def get_all_nodes():
    nodes = await app.state.db.get_all_nodes()
    if not nodes:
        return JSONResponse(
            content={"detail": "No nodes found"},
            status_code=404,
            headers={"Access-Control-Allow-Origin": "*"}
        )
    return JSONResponse(
        content=nodes,
        headers={"Access-Control-Allow-Origin": "*"}
    )


@app.get("/nodes/{id}")
async def get_node(id: int):
    node = await app.state.db.get_node_with_relationships(id)
    if not node:
        return JSONResponse(
            content={"detail": "Node not found"},
            status_code=404,
            headers={"Access-Control-Allow-Origin": "*"}
        )
    return JSONResponse(
        content=node,
        headers={"Access-Control-Allow-Origin": "*"}
    )


@app.post("/nodes", dependencies=[Depends(get_current_token)])
async def add_node(node: Node):
    await app.state.db.add_node_and_relationships(node.label, node.properties, node.relationships)
    return JSONResponse(
        content={"message": "Node and relationships added successfully"},
        headers={"Access-Control-Allow-Origin": "*"}
    )


@app.delete("/nodes/{id}", dependencies=[Depends(get_current_token)])
async def delete_node(id: int):
    await app.state.db.delete_node(id)
    return JSONResponse(
        content={"message": "Node and relationships deleted successfully"},
        headers={"Access-Control-Allow-Origin": "*"}
    )


@app.get("/nodes/graph")
async def get_graph():
    nodes_data = await app.state.db.get_all_nodes()
    if not nodes_data:
        return JSONResponse(
            content={"detail": "No nodes found"},
            status_code=404,
            headers={"Access-Control-Allow-Origin": "*"}
        )

    graph_data = []

    for node in nodes_data:
        relationships = await app.state.db.get_node_with_relationships(node["id"])
        graph_data.append({
            "node": node,
            "relationships": relationships
        })

    return JSONResponse(
        content=graph_data,
        headers={"Access-Control-Allow-Origin": "*"}
    )
