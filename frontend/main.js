import * as THREE from 'three';
import axios from 'axios';
import { OrbitControls } from 'three-stdlib';

let scene, camera, renderer, controls;

async function fetchGraphData() {
    try {
        const response = await axios.get('http://127.0.0.1:8000/nodes');
        return response.data;
    } catch (error) {
        console.error('Error fetching graph data:', error);
        return []; // Возвращаем пустой массив в случае ошибки
    }
}

async function init() {
    // Инициализация сцены, камеры, рендерера
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // Управление камерой
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    controls.screenSpacePanning = false;

    camera.position.set(0, 0, 10);

    // Получаем данные с API
    const graphData = await fetchGraphData();
    console.log("Received graph data:", graphData); // Для отладки

    // Визуализируем данные
    graphData.forEach(item => {
        // Отобразим узлы как сферы
        const sphereGeometry = new THREE.SphereGeometry(0.5, 32, 32);
        const sphereMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);

        // Размещаем сферу на случайной позиции
        sphere.position.set(Math.random() * 5 - 2.5, Math.random() * 5 - 2.5, Math.random() * 5 - 2.5);

        // Добавляем сферу в сцену
        scene.add(sphere);
    });

    animate();
}

function animate() {
    requestAnimationFrame(animate);

    controls.update(); // обновляем управление камерой
    renderer.render(scene, camera); // рендерим сцену
}

init();
