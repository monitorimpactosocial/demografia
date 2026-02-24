let globalData = null;
let globalGeojson = null;
let charts = {}; // Store chart instances to destroy/update later if needed
let maps = {}; // Store leafet map instances

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Setup Tab Interactions
    setupTabs();

    // 2. Load Data
    try {
        // Prevent browser caching the old data.json by appending a timestamp query string
        const v = new Date().getTime();
        const [resData, resGeo] = await Promise.all([
            fetch('data.json?v=' + v),
            fetch('concepcion.geojson?v=' + v)
        ]);

        globalData = await resData.json();
        globalGeojson = await resGeo.json();

        // Initialize the first tab (General) by default
        renderGeneralTab(globalData);
    } catch (error) {
        console.error("Error loading data:", error);
        document.getElementById('total-pop').innerText = "Error loading data.";
    }
});

function setupTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active from all
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            // Add active to clicked
            btn.classList.add('active');
            const target = btn.getAttribute('data-tab');
            document.getElementById(target).classList.add('active');

            // Render specific tab content if not already rendered
            if (globalData) {
                if (target === 'tab-general') renderGeneralTab(globalData);
                if (target === 'tab-distritos') {
                    renderDistritosTab(globalData);
                    if (globalGeojson) renderMapDistritos(globalData, globalGeojson);
                }
                if (target === 'tab-laboral') {
                    renderLaboralTab(globalData);
                    if (globalGeojson) renderMapLaboral(globalData, globalGeojson);
                }
            }
        });
    });
}

function animateValue(obj, start, end, duration) {
    if (!obj) return;
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.innerHTML = Math.floor(progress * (end - start) + start).toLocaleString('es-PY');
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

// ----------------------------------------------------
// TAB 1: General Demography
// ----------------------------------------------------
function renderGeneralTab(data) {
    const summary = data.summary;
    const dist = data.age_distribution;

    animateValue(document.getElementById('total-pop'), 0, summary.total_population, 1000);
    animateValue(document.getElementById('total-hombres'), 0, summary.total_hombres, 1000);
    animateValue(document.getElementById('total-mujeres'), 0, summary.total_mujeres, 1000);

    const mPercent = (summary.total_hombres / summary.total_population) * 100;
    const fPercent = (summary.total_mujeres / summary.total_population) * 100;

    setTimeout(() => {
        const mh = document.getElementById('bar-hombres');
        const fm = document.getElementById('bar-mujeres');
        if (mh) mh.style.width = `${mPercent}%`;
        if (fm) fm.style.width = `${fPercent}%`;
    }, 100);

    if (!charts['pyramid']) {
        const ctxPyramid = document.getElementById('pyramidChart').getContext('2d');
        const labels = dist.map(d => d.age_group);
        const hombresData = dist.map(d => -Math.abs(d.hombres));
        const mujeresData = dist.map(d => d.mujeres);

        charts['pyramid'] = new Chart(ctxPyramid, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    { label: 'Hombres', data: hombresData, backgroundColor: 'rgba(59, 130, 246, 0.8)' },
                    { label: 'Mujeres', data: mujeresData, backgroundColor: 'rgba(236, 72, 153, 0.8)' }
                ]
            },
            options: {
                indexAxis: 'y',
                responsive: true, maintainAspectRatio: false, stacked: true,
                plugins: {
                    tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${Math.abs(c.raw).toLocaleString('es-PY')}` } },
                    legend: { labels: { color: '#f8fafc' } }
                },
                scales: {
                    x: {
                        stacked: true,
                        ticks: { color: '#94a3b8', callback: (v) => Math.abs(v).toLocaleString('es-PY') },
                        grid: { color: 'rgba(148, 163, 184, 0.1)' }
                    },
                    y: { stacked: true, ticks: { color: '#94a3b8' }, grid: { display: false } }
                }
            }
        });
    }

    if (!charts['doughnut']) {
        const ctxDoughnut = document.getElementById('doughnutChart').getContext('2d');
        charts['doughnut'] = new Chart(ctxDoughnut, {
            type: 'doughnut',
            data: {
                labels: ['Hombres', 'Mujeres'],
                datasets: [{
                    data: [summary.total_hombres, summary.total_mujeres],
                    backgroundColor: ['rgba(59, 130, 246, 0.8)', 'rgba(236, 72, 153, 0.8)'],
                    borderWidth: 0, hoverOffset: 10
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false, cutout: '75%',
                plugins: {
                    legend: { position: 'bottom', labels: { color: '#f8fafc', padding: 20 } },
                }
            }
        });
    }
}

// ----------------------------------------------------
// TAB 2: District Demography
// ----------------------------------------------------
function renderDistritosTab(data) {
    const distritos = data.distritos;

    // Total Mediana is usually the first row (Concepción usually has the overall, but let's calculate average or take the first assuming it's the department total)
    // Wait, the python script extracted districts rows 8-20. Total was row 7. But in our script we ONLY appended districts (rows 8-19).
    // Let's check: We have 'Concepción' as the first district which in Cuadro 1.2 is actually the district of Concepción, not the total.
    // We can just compute average median age for display, or show the total dept median (which we didn't extract).
    // Let's just calculate average median age of districts.
    const avgMediana = Math.round(distritos.reduce((acc, curr) => acc + curr.edad_mediana, 0) / distritos.length);
    document.getElementById('mediana-dept').innerText = avgMediana + " años";

    // Most Populated District
    const maxPop = distritos.reduce((prev, current) => (prev.total > current.total) ? prev : current);
    document.getElementById('max-pop-dist').innerText = maxPop.distrito;

    if (!charts['distBar']) {
        const labels = distritos.map(d => d.distrito);
        const totals = distritos.map(d => d.total);

        const ctx = document.getElementById('distritosBarChart').getContext('2d');
        charts['distBar'] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Población Total',
                    data: totals,
                    backgroundColor: 'rgba(16, 185, 129, 0.7)',
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { ticks: { color: '#94a3b8', autoSkip: false, maxRotation: 45, minRotation: 45 } },
                    y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148, 163, 184, 0.1)' } }
                }
            }
        });
    }

    if (!charts['distLine']) {
        const labels = distritos.map(d => d.distrito);
        const medianas = distritos.map(d => d.edad_mediana);

        const ctx = document.getElementById('distritosLineChart').getContext('2d');
        charts['distLine'] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Edad Mediana',
                    data: medianas,
                    borderColor: 'rgba(245, 158, 11, 1)',
                    backgroundColor: 'rgba(245, 158, 11, 0.2)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 6,
                    pointHoverRadius: 8
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { ticks: { color: '#94a3b8', autoSkip: false, maxRotation: 45, minRotation: 45 } },
                    y: { ticks: { color: '#94a3b8' }, suggestedMin: 15, suggestedMax: 35, grid: { color: 'rgba(148, 163, 184, 0.1)' } }
                }
            }
        });
    }
}

// ----------------------------------------------------
// TAB 3: Labor Activity
// ----------------------------------------------------
function renderLaboralTab(data) {
    const laboral = data.laboral;

    // Calculate totals for the summary metrics
    const totalFT = laboral.reduce((acc, curr) => acc + curr.fuerza_trabajo, 0);
    const totalFFT = laboral.reduce((acc, curr) => acc + curr.fuera_fuerza_trabajo, 0);
    const total15 = laboral.reduce((acc, curr) => acc + curr.poblacion_15_mas, 0);

    animateValue(document.getElementById('total-ft'), 0, totalFT, 1000);
    animateValue(document.getElementById('total-fft'), 0, totalFFT, 1000);

    setTimeout(() => {
        const bft = document.getElementById('bar-ft');
        const bfft = document.getElementById('bar-fft');
        if (bft) bft.style.width = `${(totalFT / total15) * 100}%`;
        if (bfft) bfft.style.width = `${(totalFFT / total15) * 100}%`;
    }, 100);

    if (!charts['labStacked']) {
        const labels = laboral.map(l => l.distrito);
        const ft = laboral.map(l => l.fuerza_trabajo);
        const fft = laboral.map(l => l.fuera_fuerza_trabajo);

        const ctx = document.getElementById('laboralStackedChart').getContext('2d');
        charts['labStacked'] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    { label: 'Fuerza de Trabajo', data: ft, backgroundColor: 'rgba(16, 185, 129, 0.8)' },
                    { label: 'Fuera FT (Inactivos/Desempleo)', data: fft, backgroundColor: 'rgba(245, 158, 11, 0.8)' }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { labels: { color: '#f8fafc' } } },
                scales: {
                    x: { stacked: true, ticks: { color: '#94a3b8', maxRotation: 45, minRotation: 45 } },
                    y: { stacked: true, ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148, 163, 184, 0.1)' } }
                }
            }
        });
    }

    if (!charts['labTasa']) {
        const labels = laboral.map(l => l.distrito);
        const tasaFT = laboral.map(l => l.tasa_fuerza_trabajo);

        const ctx = document.getElementById('laboralTasaChart').getContext('2d');
        charts['labTasa'] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Tasa Fuerza de Trabajo (%)',
                    data: tasaFT,
                    backgroundColor: 'rgba(59, 130, 246, 0.7)',
                    borderRadius: 4
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { ticks: { color: '#94a3b8' }, suggestedMax: 100, grid: { color: 'rgba(148, 163, 184, 0.1)' } },
                    y: { ticks: { color: '#94a3b8' }, grid: { display: false } }
                }
            }
        });
    }
}

// ----------------------------------------------------
// MAP LOGIC
// ----------------------------------------------------

function getColorPop(d) {
    return d > 50000 ? '#047857' : // emerald-700
        d > 20000 ? '#10b981' : // emerald-500
            d > 10000 ? '#34d399' : // emerald-400
                d > 5000 ? '#6ee7b7' : // emerald-300
                    '#a7f3d0';  // emerald-200
}

function renderMapDistritos(data, geojson) {
    if (maps['distritos']) return;

    // Create a dictionary for quick lookup O(1)
    const distData = {};
    data.distritos.forEach(d => {
        distData[d.distrito] = d;
    });

    const map = L.map('map-distritos').setView([-23.1, -57.1], 7);
    maps['distritos'] = map;

    // Add a dark basemap pattern or simply rely on the background color if no tiles
    // Usually a carto dark layer looks best:
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);

    function style(feature) {
        const info = distData[feature.properties.distrito];
        const pop = info ? info.total : 0;
        return {
            fillColor: getColorPop(pop),
            weight: 2,
            opacity: 1,
            color: 'white',
            dashArray: '3',
            fillOpacity: 0.7
        };
    }

    function onEachFeature(feature, layer) {
        const info = distData[feature.properties.distrito];
        if (info) {
            const popupContent = `
                <div class="custom-popup">
                    <strong>${feature.properties.distrito}</strong><br/>
                    Población Total: ${info.total.toLocaleString('es-PY')}<br/>
                    Hombres: ${info.hombres.toLocaleString('es-PY')}<br/>
                    Mujeres: ${info.mujeres.toLocaleString('es-PY')}<br/>
                    Edad Mediana: ${info.edad_mediana} años
                </div>
            `;
            layer.bindPopup(popupContent);
        }

        layer.on({
            mouseover: (e) => {
                var layer = e.target;
                layer.setStyle({
                    weight: 3,
                    color: '#f8fafc',
                    dashArray: '',
                    fillOpacity: 0.9
                });
                layer.bringToFront();
            },
            mouseout: (e) => {
                geojsonLayer.resetStyle(e.target);
            }
        });
    }

    const geojsonLayer = L.geoJson(geojson, {
        style: style,
        onEachFeature: onEachFeature
    }).addTo(map);

    // Fit map bounds to the geojson layer
    map.fitBounds(geojsonLayer.getBounds());
}

function getColorLab(d) {
    return d > 70 ? '#1d4ed8' : // blue-700
        d > 60 ? '#2563eb' : // blue-600
            d > 50 ? '#3b82f6' : // blue-500
                d > 40 ? '#60a5fa' : // blue-400
                    '#93c5fd';  // blue-300
}

function renderMapLaboral(data, geojson) {
    if (maps['laboral']) return;

    const labData = {};
    data.laboral.forEach(d => {
        labData[d.distrito] = d;
    });

    // In a multi-tab setup, leafet map containers size might be 0 if initialized while hidden.
    // Ensure the container is fully visible before initializing, or invalidateSize immediately.
    setTimeout(() => {
        const map = L.map('map-laboral').setView([-23.1, -57.1], 7);
        maps['laboral'] = map;

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; CARTO',
            subdomains: 'abcd',
            maxZoom: 20
        }).addTo(map);

        function style(feature) {
            const info = labData[feature.properties.distrito];
            const tasa = info ? info.tasa_fuerza_trabajo : 0;
            return {
                fillColor: getColorLab(tasa),
                weight: 2,
                opacity: 1,
                color: 'white',
                dashArray: '3',
                fillOpacity: 0.8
            };
        }

        function onEachFeature(feature, layer) {
            const info = labData[feature.properties.distrito];
            if (info) {
                const popupContent = `
                    <div class="custom-popup">
                        <strong>${feature.properties.distrito}</strong><br/>
                        Tasa Fuerza Trabajo: ${info.tasa_fuerza_trabajo}%<br/>
                        Fuerza de Trabajo: ${info.fuerza_trabajo.toLocaleString('es-PY')}<br/>
                        Fuera de Fuerza: ${info.fuera_fuerza_trabajo.toLocaleString('es-PY')}
                    </div>
                `;
                layer.bindPopup(popupContent);
            }

            layer.on({
                mouseover: (e) => {
                    var layer = e.target;
                    layer.setStyle({ weight: 3, color: '#f8fafc', dashArray: '', fillOpacity: 1 });
                    layer.bringToFront();
                },
                mouseout: (e) => {
                    geojsonLayer.resetStyle(e.target);
                }
            });
        }

        const geojsonLayer = L.geoJson(geojson, {
            style: style,
            onEachFeature: onEachFeature
        }).addTo(map);

        map.fitBounds(geojsonLayer.getBounds());
    }, 100);
}
