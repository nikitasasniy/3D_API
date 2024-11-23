import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Создаем рендерер
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
console.log("Рендерер создан и добавлен в DOM");

// Создаем сцену
const scene = new THREE.Scene();
console.log("Сцена создана");

// Создаем камеру
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 10000);
camera.position.set(0, 20, 100);
console.log("Камера создана и расположена на позиции (0, 20, 100)");

// Создаем контроллер для вращения сцены
const controls = new OrbitControls(camera, renderer.domElement);
console.log("Контроллер OrbitControls создан");

// Словарь для хранения узлов и связей
const nodes = {};
const edges = [];

// Множество для проверки уникальности пользователей
const uniqueUsers = new Set();

// Луч для обнаружения объектов
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Функция для получения данных об узле
async function fetchNodeData(id) {
  try {
    console.log(`Загрузка данных для узла с ID: ${id}`);
    const response = await fetch(`http://127.0.0.1:8000/nodes/${id}`);
    if (!response.ok) {
      throw new Error('Ошибка при получении данных пользователя');
    }
    console.log("Данные узла успешно получены");
    return await response.json();
  } catch (error) {
    console.error('Ошибка при получении данных узла:', error);
    return null;
  }
}

// Функция для получения данных о графе
async function fetchGraphData() {
  try {
    console.log("Загрузка данных графа");
    const response = await fetch('http://127.0.0.1:8000/graph');
    if (!response.ok) {
      throw new Error('Ошибка при получении данных графа');
    }
    console.log("Данные графа успешно получены");
    return await response.json();
  } catch (error) {
    console.error('Ошибка при получении данных графа:', error);
    return [];
  }
}

// Функция для генерации случайных координат внутри сферы
function generateRandomSphereCoordinates(count, radius) {
  const coordinates = [];
  for (let i = 0; i < count; i++) {
    const phi = Math.random() * 2 * Math.PI; // Угол азимута
    const theta = Math.acos(2 * Math.random() - 1); // Угол наклона
    const r = Math.cbrt(Math.random()) * radius; // Радиус (с кубическим корнем для равномерного распределения)

    const x = r * Math.sin(theta) * Math.cos(phi);
    const y = r * Math.cos(theta);
    const z = r * Math.sin(theta) * Math.sin(phi);

    coordinates.push(new THREE.Vector3(x, y, z));
  }
  return coordinates;
}

// Функция для создания узла
function createNode(color, id, nodeData) {
  console.log(`Создание узла с ID: ${id} и цветом: ${color.toString(16)}`);
  const geometry = new THREE.SphereGeometry(0.5, 16, 16);
  const material = new THREE.MeshBasicMaterial({ color });
  const node = new THREE.Mesh(geometry, material);
  node.userData = { id };
  node.nodeData = nodeData;
  return node;
}

// Функция для создания линии между двумя точками
function createLine(start, end) {
  console.log("Создание линии между узлами");
  const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
  const material = new THREE.LineBasicMaterial({ color: 0x0000ff });
  return new THREE.Line(geometry, material);
}

// Функция для создания графа
async function createGraph() {
  console.log("Начинаем создание графа...");
  const graphData = await fetchGraphData();

  const nodeCount = graphData.length; // Количество узлов
  const sphereRadius = 50; // Радиус сферы
  const sphereCoordinates = generateRandomSphereCoordinates(nodeCount, sphereRadius);

  let currentIndex = 0;

  graphData.forEach((edge) => {
    const { node, relationship, target_node } = edge;

    // Добавляем узел-источник
    if (!uniqueUsers.has(node.attributes.id)) {
      console.log(`Добавление узла-источника с ID: ${node.attributes.id}`);
      uniqueUsers.add(node.attributes.id);
      const userNode = createNode(0xff0000, node.attributes.id, node);
      userNode.position.copy(sphereCoordinates[currentIndex++]);
      scene.add(userNode);
      nodes[node.attributes.id] = userNode;
    }

    // Добавляем узел-цель
    if (!uniqueUsers.has(target_node.attributes.id)) {
      console.log(`Добавление узла-цели с ID: ${target_node.attributes.id}`);
      uniqueUsers.add(target_node.attributes.id);
      const targetUserNode = createNode(0x00ff00, target_node.attributes.id, target_node);
      targetUserNode.position.copy(sphereCoordinates[currentIndex++]);
      scene.add(targetUserNode);
      nodes[target_node.attributes.id] = targetUserNode;
    }

    // Добавляем связь
    const sourceNode = nodes[node.attributes.id];
    const targetNode = nodes[target_node.attributes.id];
    if (sourceNode && targetNode) {
      console.log(`Добавление связи между узлами с ID: ${node.attributes.id} и ${target_node.attributes.id}`);
      const line = createLine(sourceNode.position, targetNode.position);
      scene.add(line);
      edges.push(line);
    }
  });
}

// Обработка клика на узле
async function onMouseClick(event) {
  console.log("Обработка клика...");
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(Object.values(nodes));

  if (intersects.length > 0) {
    const clickedNode = intersects[0].object;
    const nodeData = clickedNode.nodeData;

    console.log(`Клик на узел с ID: ${nodeData.attributes.id}`);

    // Получаем данные о пользователе или группе
    const data = await fetchNodeData(nodeData.attributes.id);
    if (!data || data.length === 0) {
      alert('Нет данных для этого узла.');
      return;
    }

    // Главные данные узла
    const mainNode = data[0]?.node?.attributes;
    if (!mainNode) {
      alert('Главные данные узла отсутствуют.');
      return;
    }

    // Проверка типа узла (Group или User)
    const isGroup = data[0]?.node?.label.includes("Group");

    // Формируем текст для главных данных
    const mainNodeText = isGroup
      ? `Информация о группе:
        Название: ${mainNode.name || 'Не указано'}
        Логин: ${mainNode.screen_name || 'Не указан'}
        ID: ${mainNode.id || 'Не указано'}`
      : `Информация о пользователе:
        Имя: ${mainNode.name || 'Не указано'}
        Логин: ${mainNode.screen_name || 'Не указан'}
        Город: ${mainNode.home_town || 'Не указан'}
        Пол: ${mainNode.sex || 'Не указан'}
        Подписчиков: ${mainNode.followers_count || 'Не указано'}
        Подписок: ${mainNode.subscriptions_count || 'Не указано'}`;

    // Формируем текст для подписок (если есть)
    const subscriptions = data.map((edge) => {
      const target = edge?.target_node?.attributes;
      if (!target) return null;

      const targetType = edge?.target_node?.label.includes("Group") ? "Группа" : "Пользователь";
      return `${targetType}: ${target.name || 'Не указано'} (${target.screen_name || 'Не указан'})`;
    }).filter(Boolean);

    const subscriptionsText = subscriptions.length > 0
      ? `Подписки:\n${subscriptions.join('\n')}`
      : 'Подписки отсутствуют.';

    // Отображаем данные в окне
    alert(mainNodeText + '\n\n' + subscriptionsText);
  }
}


// Загружаем граф
createGraph();

// Добавляем слушатель событий
window.addEventListener('click', onMouseClick);

// Анимация
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();
