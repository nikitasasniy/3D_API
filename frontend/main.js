// Функция для загрузки данных графа с API
async function fetchGraphData() {
    try {
        const response = await fetch('http://127.0.0.1:8000/graph'); // Путь к вашему API
        if (!response.ok) {
            throw new Error('Failed to fetch graph data');
        }
        return await response.json(); // Возвращаем данные в формате JSON
    } catch (error) {
        console.error('Error fetching graph data:', error);
    }
}

// Функция для визуализации графа с использованием D3.js
function visualizeGraph(graphData) {
    const width = 800;
    const height = 600;

    const svg = d3.select('#graph')
        .append('svg')
        .attr('width', width)
        .attr('height', height);

    const links = [];
    const nodes = [];
    const nodeIds = new Set();  // Для того чтобы избежать дублирования узлов

    // Подготовка данных для D3.js (граф)
    graphData.forEach(item => {
        const node = item.node;
        const targetNode = item.target_node;

        // Добавляем узлы, если их еще нет
        if (!nodeIds.has(node.id)) {
            nodes.push({ id: node.id, label: node.attributes.name, type: node.label[0] });
            nodeIds.add(node.id);
        }

        if (!nodeIds.has(targetNode.id)) {
            nodes.push({ id: targetNode.id, label: targetNode.attributes.name, type: targetNode.label[0] });
            nodeIds.add(targetNode.id);
        }

        // Добавляем связь между узлами
        links.push({
            source: node.id,
            target: targetNode.id,
            type: item.relationship.type
        });
    });

    // Создание силовой симуляции для графа
    const simulation = d3.forceSimulation(nodes)
        .force('link', d3.forceLink(links).id(d => d.id).distance(100))
        .force('charge', d3.forceManyBody().strength(-200))
        .force('center', d3.forceCenter(width / 2, height / 2));

    // Создание группы для всех элементов, чтобы они могли быть трансформированы (масштабирование, вращение)
    const graphGroup = svg.append('g');

    // Визуализация ссылок (линий)
    const link = graphGroup.selectAll('.link')
        .data(links)
        .enter().append('line')
        .attr('class', 'link')
        .attr('stroke', '#999')
        .attr('stroke-width', 2);

    // Визуализация узлов (кругов)
    const node = graphGroup.selectAll('.node')
        .data(nodes)
        .enter().append('circle')
        .attr('class', 'node')
        .attr('r', 10)
        .attr('fill', d => d.type === 'User' ? '#69b3a2' : '#FF5733') // Цвет в зависимости от типа (User или Group)
        .call(d3.drag()
            .on('start', dragStart)
            .on('drag', dragging)
            .on('end', dragEnd))
        .on('click', showNodeInfo);  // Обработчик клика на узел

    // Добавление всплывающих подсказок для узлов
    node.append('title')
        .text(d => d.label);

    // Обновление положений элементов на экране
    simulation.on('tick', () => {
        link.attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);

        node.attr('cx', d => d.x)
            .attr('cy', d => d.y);
    });

    // Функции для перетаскивания узлов
    function dragStart(event, d) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }

    function dragging(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    }

    function dragEnd(event, d) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    }

    // Обработчик масштабирования и перемещения графа
    const zoom = d3.zoom()
        .scaleExtent([0.1, 3]) // Определение диапазона масштабирования
        .on('zoom', (event) => {
            graphGroup.attr('transform', event.transform); // Применение трансформации
        });

    svg.call(zoom); // Применение zoom на весь граф

    // Функция для отображения информации о узле
    function showNodeInfo(event, d) {
        // Здесь можно отображать информацию в модальном окне, всплывающем окне или другом UI
        alert(`Node Info:\nID: ${d.id}\nName: ${d.label}\nType: ${d.type}`);
    }

    // Функция для вычисления центра масс
    function calculateCenterOfMass(nodes) {
        let x = 0, y = 0;
        nodes.forEach(node => {
            x += node.x;
            y += node.y;
        });
        return { x: x / nodes.length, y: y / nodes.length };
    }

    // Вращение вокруг центра масс
    function rotateGraph(angle) {
        const center = calculateCenterOfMass(nodes);
        const radians = angle * Math.PI / 180;
        nodes.forEach(node => {
            const dx = node.x - center.x;
            const dy = node.y - center.y;
            node.x = center.x + (dx * Math.cos(radians) - dy * Math.sin(radians));
            node.y = center.y + (dx * Math.sin(radians) + dy * Math.cos(radians));
        });

        simulation.alpha(1).restart();
    }

    // Пример использования вращения: вращаем на 10 градусов каждый раз
    setInterval(() => rotateGraph(10), 1000); // Пример вращения (по 10 градусов каждую секунду)
}

// Загрузка графа при нажатии на кнопку
document.getElementById('load-graph-btn').addEventListener('click', async () => {
    const graphData = await fetchGraphData();
    if (graphData) {
        visualizeGraph(graphData);
    }
});
