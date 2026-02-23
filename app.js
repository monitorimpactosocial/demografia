document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('data.json');
        const data = await response.json();
        
        initDashboard(data);
    } catch (error) {
        console.error("Error loading data:", error);
        document.getElementById('total-pop').innerText = "Error loading data.";
    }
});

function animateValue(obj, start, end, duration) {
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

function initDashboard(data) {
    const summary = data.summary;
    const dist = data.age_distribution;

    // 1. Update Metrics
    const popEl = document.getElementById('total-pop');
    const homEl = document.getElementById('total-hombres');
    const mujEl = document.getElementById('total-mujeres');

    animateValue(popEl, 0, summary.total_population, 1500);
    animateValue(homEl, 0, summary.total_hombres, 1500);
    animateValue(mujEl, 0, summary.total_mujeres, 1500);

    // Progress bar fills
    const mPercent = (summary.total_hombres / summary.total_population) * 100;
    const fPercent = (summary.total_mujeres / summary.total_population) * 100;
    
    setTimeout(() => {
        document.getElementById('bar-hombres').style.width = `${mPercent}%`;
        document.getElementById('bar-mujeres').style.width = `${fPercent}%`;
    }, 300);

    // 2. Prepare Chart Data
    const labels = dist.map(d => d.age_group);
    // For pyramid, men are negative, women are positive
    const hombresData = dist.map(d => -Math.abs(d.hombres));
    const mujeresData = dist.map(d => d.mujeres);

    // 3. Render Pyramid Chart
    const ctxPyramid = document.getElementById('pyramidChart').getContext('2d');
    
    // Custom tooltips to show absolute values for men (remove negative sign)
    const pyramidTooltip = {
        callbacks: {
            label: (context) => {
                let value = context.raw;
                return `${context.dataset.label}: ${Math.abs(value).toLocaleString('es-PY')}`;
            }
        }
    };

    new Chart(ctxPyramid, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Hombres',
                    data: hombresData,
                    backgroundColor: 'rgba(59, 130, 246, 0.8)',
                    borderColor: 'rgba(59, 130, 246, 1)',
                    borderWidth: 1,
                    borderRadius: 4,
                },
                {
                    label: 'Mujeres',
                    data: mujeresData,
                    backgroundColor: 'rgba(236, 72, 153, 0.8)',
                    borderColor: 'rgba(236, 72, 153, 1)',
                    borderWidth: 1,
                    borderRadius: 4,
                }
            ]
        },
        options: {
            indexAxis: 'y', // Makes it horizontal
            responsive: true,
            maintainAspectRatio: false,
            stacked: true,
            plugins: {
                tooltip: pyramidTooltip,
                legend: { labels: { color: '#f8fafc' } }
            },
            scales: {
                x: {
                    stacked: true,
                    ticks: {
                        color: '#94a3b8',
                        callback: (value) => Math.abs(value).toLocaleString('es-PY')
                    },
                    grid: { color: 'rgba(148, 163, 184, 0.1)' }
                },
                y: {
                    stacked: true,
                    ticks: { color: '#94a3b8' },
                    grid: { display: false }
                }
            },
            animation: {
                duration: 2000,
                easing: 'easeOutQuart'
            }
        }
    });

    // 4. Render Doughnut Chart
    const ctxDoughnut = document.getElementById('doughnutChart').getContext('2d');
    new Chart(ctxDoughnut, {
        type: 'doughnut',
        data: {
            labels: ['Hombres', 'Mujeres'],
            datasets: [{
                data: [summary.total_hombres, summary.total_mujeres],
                backgroundColor: [
                    'rgba(59, 130, 246, 0.8)',
                    'rgba(236, 72, 153, 0.8)'
                ],
                borderColor: [
                    'rgba(59, 130, 246, 1)',
                    'rgba(236, 72, 153, 1)'
                ],
                borderWidth: 2,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#f8fafc', padding: 20 }
                },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const value = context.raw;
                            const percentage = ((value / summary.total_population) * 100).toFixed(1);
                            return `${context.label}: ${value.toLocaleString('es-PY')} (${percentage}%)`;
                        }
                    }
                }
            },
            animation: {
                animateScale: true,
                animateRotate: true,
                duration: 2000
            }
        }
    });
}
