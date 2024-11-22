import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';  // Используйте jsm, а не js

// Настройки сцены
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 50;

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Контроллеры камеры
const controls = new OrbitControls(camera, renderer.domElement);

// Цвета узлов
const NODE_COLORS = {
    type1: 0xff0000,
    type2: 0x00ff00,
    type3: 0x0000ff,
};

// Узлы и связи
const nodes = [];
const edges = [];

// Генерация случайных узлов
for (let i = 0; i < 20; i++) {
    const type = `type${Math.floor(Math.random() * 3) + 1}`;
    const node = {
        id: i,
        type,
        attributes: {
            name: `Node ${i}`,
            value: Math.random().toFixed(2),
        },
        position: new THREE.Vector3(
            (Math.random() - 0.5) * 100,
            (Math.random() - 0.5) * 100,
            (Math.random() - 0.5) * 100
        ),
    };
    nodes.push(node);
}

// Создание связей
for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
        if (Math.random() < 0.2) {
            edges.push({ source: nodes[i], target: nodes[j] });
        }
    }
}

// Добавление узлов в сцену
const nodeMeshes = [];
nodes.forEach((node) => {
    const geometry = new THREE.SphereGeometry(2, 16, 16);
    const material = new THREE.MeshBasicMaterial({ color: NODE_COLORS[node.type] });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(node.position);
    mesh.userData = node; // Сохраняем данные узла для обработки событий
    scene.add(mesh);
    nodeMeshes.push(mesh);
});

// Добавление связей в сцену
const edgeLines = [];
edges.forEach((edge) => {
    const material = new THREE.LineBasicMaterial({ color: 0xffffff });
    const geometry = new THREE.BufferGeometry().setFromPoints([edge.source.position, edge.target.position]);
    const line = new THREE.Line(geometry, material);
    scene.add(line);
    edgeLines.push(line);
});

// Панель атрибутов
const attributesPanel = document.getElementById('attributes-panel');

// Обработка кликов
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function onMouseClick(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(nodeMeshes);
    if (intersects.length > 0) {
        const intersectedNode = intersects[0].object.userData;
        showAttributes(intersectedNode);
    } else {
        hideAttributes();
    }
}

function showAttributes(node) {
    attributesPanel.innerHTML = `
        <strong>${node.attributes.name}</strong><br>
        Type: ${node.type}<br>
        Value: ${node.attributes.value}<br>
        <strong>Connections:</strong>
        <ul>
            ${edges
                .filter((edge) => edge.source.id === node.id || edge.target.id === node.id)
                .map((edge) => `<li>${edge.source.id === node.id ? edge.target.id : edge.source.id}</li>`)
                .join('')}
        </ul>
    `;
    attributesPanel.style.display = 'block';
}

function hideAttributes() {
    attributesPanel.style.display = 'none';
}

window.addEventListener('click', onMouseClick);

// Анимация
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

animate();

// Адаптация размера окна
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
