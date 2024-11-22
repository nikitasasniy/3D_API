import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'; // Импортируем OrbitControls

// Создаем рендерер
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Создаем сцену
const scene = new THREE.Scene();

// Создаем камеру
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 10000);
camera.position.set(0, 20, 100);

// Создаем контроллер для вращения сцены
const controls = new OrbitControls(camera, renderer.domElement);

// Массивы для хранения узлов и линий
const nodes = [];
const lines = [];

// Функция для получения данных с API
async function fetchGraphData() {
  try {
    const response = await fetch('http://127.0.0.1:8000/graph');
    if (!response.ok) {
      throw new Error('Ошибка при получении данных');
    }
    return await response.json();
  } catch (error) {
    console.error('Ошибка при получении данных графа:', error);
  }
}

// Функция для создания графа
async function createGraph() {
  const graphData = await fetchGraphData();

  if (!graphData) return;

  // Количество узлов
  const numNodes = graphData.length * 2; // удваиваем количество, так как для каждого пользователя и группы создается по узлу

  // Функция для равномерного распределения узлов по пространству
  function distributeNodes(numNodes) {
    const nodesArray = [];
    const maxDist = 30; // Максимальное расстояние для распределения узлов

    for (let i = 0; i < numNodes; i++) {
      const x = (Math.random() - 0.5) * maxDist * 2;
      const y = (Math.random() - 0.5) * maxDist * 2;
      const z = (Math.random() - 0.5) * maxDist * 2;

      nodesArray.push(new THREE.Vector3(x, y, z));
    }

    return nodesArray;
  }

  // Получаем случайно распределенные позиции для узлов
  const nodePositions = distributeNodes(numNodes);

  // Сила притяжения для связанного узла
  const attractionForce = 2;
  // Сила отталкивания для несвязанного узла
  const repulsionForce = 1.5;
  const repulsionDistance = 10;

  // Проходим по данным графа и создаем узлы и связи
  graphData.forEach((edge, index) => {
    const userNode = createNode(0xff0000); // Красный для пользователя
    userNode.position.copy(nodePositions[index * 2]);
    scene.add(userNode);
    nodes.push(userNode);

    const groupNode = createNode(0x0000ff); // Синий для группы
    groupNode.position.copy(nodePositions[index * 2 + 1]);
    scene.add(groupNode);
    nodes.push(groupNode);

    // Создаем связь между пользователем и группой
    const geometry = new THREE.BufferGeometry().setFromPoints([userNode.position, groupNode.position]);
    const material = new THREE.LineBasicMaterial({ color: 0x888888 });
    const line = new THREE.Line(geometry, material);
    scene.add(line);
    lines.push(line);

    // Притягиваем узлы, связанные друг с другом
    applyAttraction(userNode, groupNode, attractionForce);
  });

  // Применяем отталкивание для всех пар узлов
  applyRepulsion(nodes, repulsionForce, repulsionDistance);
}

// Функция для создания узла
function createNode(color) {
  const geometry = new THREE.SphereGeometry(0.5, 16, 16);
  const material = new THREE.MeshBasicMaterial({ color });
  const node = new THREE.Mesh(geometry, material);
  return node;
}

// Функция для притяжения между двумя узлами
function applyAttraction(node1, node2, force) {
  const vector = new THREE.Vector3().subVectors(node2.position, node1.position);
  const distance = vector.length();
  if (distance < 5) return; // Убедимся, что узлы не слишком близко

  const direction = vector.normalize();
  node1.position.add(direction.multiplyScalar(force));
  node2.position.sub(direction.multiplyScalar(force));
}

// Функция для отталкивания всех узлов друг от друга
function applyRepulsion(nodes, force, distanceThreshold) {
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const node1 = nodes[i];
      const node2 = nodes[j];

      const vector = new THREE.Vector3().subVectors(node2.position, node1.position);
      const distance = vector.length();

      if (distance < distanceThreshold) {
        const direction = vector.normalize();
        node1.position.sub(direction.multiplyScalar(force));
        node2.position.add(direction.multiplyScalar(force));
      }
    }
  }
}

// Загружаем и строим граф
createGraph();

// Функция анимации
function animate() {
  requestAnimationFrame(animate);

  // Обновляем контроллер
  controls.update();

  // Отображаем сцену
  renderer.render(scene, camera);
}

// Запуск анимации
animate();
