
// ==================== ECONOMIC INDICATORS ====================
const refreshIndicatorsBtn = document.getElementById('refreshIndicatorsBtn');
const indicatorsList = document.getElementById('indicatorsList');

function getImpactStars(impact) {
    if (impact === 'High') return '⭐⭐⭐';
    if (impact === 'Medium') return '⭐⭐';
    if (impact === 'Low') return '⭐';
    return '';
}

function renderEconomicEvents(events) {
    if (!indicatorsList) return;
    indicatorsList.innerHTML = '';

    if (!events || events.length === 0) {
        indicatorsList.innerHTML = '<div class="loading-spinner">표시할 데이터가 없습니다</div>';
        return;
    }

    const fragment = document.createDocumentFragment();

    events.forEach(event => {
        const el = document.createElement('div');
        el.className = `event-item impact-${event.impact}`;

        el.innerHTML = `
                <div class="event-time-box">
                    <span class="event-date">${event.date}</span>
                    <span class="event-time">${event.time}</span>
                </div>
                <div class="event-details">
                    <div class="event-title">${event.title}</div>
                    <div class="event-meta">
                        <span class="event-currency">${event.country}</span>
                        <span class="event-impact">${getImpactStars(event.impact)}</span>
                    </div>
                </div>
            `;
        fragment.appendChild(el);
    });

    indicatorsList.appendChild(fragment);
}

function loadEconomicEvents() {
    if (!indicatorsList) return;

    indicatorsList.innerHTML = '<div class="loading-spinner">데이터 불러오는 중...</div>';

    chrome.runtime.sendMessage({ action: "fetchEconomicEvents" }, (response) => {
        if (response && response.success) {
            renderEconomicEvents(response.events);
        } else {
            indicatorsList.innerHTML = `<div class="loading-spinner">데이터 로드 실패: ${response.error || 'Unknown error'}</div>`;
        }
    });
}

// Refresh button listener
if (refreshIndicatorsBtn) {
    refreshIndicatorsBtn.addEventListener('click', () => {
        loadEconomicEvents();
    });
}

// Load events when tab is switched
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        if (btn.getAttribute('data-tab') === 'tab-indicators') {
            loadEconomicEvents();
        }
    });
});

