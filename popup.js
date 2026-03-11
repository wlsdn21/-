// Popup Logic

"use strict";

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {

    // DOM Elements
    const rateValue = document.getElementById('rateValue');
    const lastUpdate = document.getElementById('lastUpdate');
    const statusIndicator = document.getElementById('statusIndicator');
    const autoRefreshTimer = document.getElementById('autoRefreshTimer');
    const enableToggle = document.getElementById('enableToggle');
    const billionToggle = document.getElementById('billionToggle');
    const trillionToggle = document.getElementById('trillionToggle');
    const decimalSelect = document.getElementById('decimalSelect');
    const rateSourceToggle = document.getElementById('rateSourceToggle');
    const rateSourceOptions = document.getElementById('rateSourceOptions');
    const rateSourceOptionElements = document.querySelectorAll('.rate-source-option');

    // Custom Rate Elements
    const customRateInputContainer = document.getElementById('customRateInputContainer');
    const customRateInput = document.getElementById('customRateInput');
    const saveCustomRateBtn = document.getElementById('saveCustomRateBtn');

    // Pop-out Logic
    const popOutBtn = document.getElementById('popOutBtn');
    if (popOutBtn) {
        popOutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            chrome.windows.create({
                url: 'popup.html',
                type: 'popup',
                width: 380,
                height: 600
            });
            window.close(); // Close current popup
        });
    }

    // ... (rest of code 1) ...

    // Helper functions moved to PopupCore (popup-core.js)

    // Update auto-refresh timer UI
    function updateRefreshTimer(rateSource, lastFetchTime) {
        const text = PopupCore.getRefreshTimerText(rateSource, lastFetchTime);
        autoRefreshTimer.textContent = text;
    }

    // Update status indicator
    function updateStatus(status) {
        // Reset classes
        statusIndicator.className = 'status-indicator';

        if (status === 'success') {
            statusIndicator.classList.add('status-success');
            statusIndicator.title = '갱신 성공';
        } else if (status === 'failed') {
            statusIndicator.classList.add('status-error');
            statusIndicator.title = '갱신 실패 (재시도 중)';
        } else if (status === 'loading') {
            statusIndicator.classList.add('status-loading');
            statusIndicator.title = '갱신 중...';
        } else {
            statusIndicator.title = '대기 중';
        }
    }





    function loadData() {
        chrome.storage.local.get([
            'usdkrw',
            'customRateValue', // Load custom value
            'lastFetchTime',
            'lastFetchStatus',
            'lastFetchError',  // Add error message
            'isEnabled',
            'showBillionUnit',
            'showTrillionUnit',
            'decimalPlaces',
            'rateSource'
        ], (result) => {



            // Update rate display
            if (result.usdkrw && result.usdkrw > 0) {
                const rateSource = result.rateSource || 'usd_krw'; // Default source is fine visually
                rateValue.textContent = PopupCore.formatRate(result.usdkrw, rateSource);
            } else {
                // If no data found, don't show 1300. Show real status.
                rateValue.textContent = '환율 정보 없음';
                // Trigger refresh
                chrome.runtime.sendMessage({ action: 'refreshRate' });
            }

            const rateSource = result.rateSource || 'usd_krw';

            // Update last update time
            lastUpdate.textContent = PopupCore.formatRelativeTime(result.lastFetchTime);

            // Update status indicator
            const status = result.lastFetchStatus || 'loading';
            updateStatus(status);

            // Show error message if API failed
            if (result.lastFetchError && status === 'failed') {
                // Add subtle error indicator
                const errorHint = ` (오류: ${result.lastFetchError.substring(0, 30)}...)`;
                if (!lastUpdate.textContent.includes('오류')) {
                    lastUpdate.textContent += errorHint;
                }
            }

            // Update settings UI
            enableToggle.checked = result.isEnabled !== undefined ? result.isEnabled : true;
            billionToggle.checked = result.showBillionUnit !== undefined ? result.showBillionUnit : true;
            trillionToggle.checked = result.showTrillionUnit !== undefined ? result.showTrillionUnit : true;
            decimalSelect.value = result.decimalPlaces !== undefined ? result.decimalPlaces : 2;

            // Set input value
            if (result.customRateValue) {
                customRateInput.value = result.customRateValue;
            }

            // Update selected rate source option
            updateSelectedRateSource(rateSource);

            // Update refresh timer
            updateRefreshTimer(rateSource, result.lastFetchTime);

            // Force refresh if stuck on old default
            // But now we don't default to 1300 unless it's genuinely saved as 1300.
            if (result.usdkrw === 1300 && rateSource !== 'custom') {

                updateStatus('loading');
                chrome.runtime.sendMessage({ action: 'refreshRate' });
            }
        });
    }

    // Update selected rate source option
    function updateSelectedRateSource(rateSource) {
        rateSourceOptionElements.forEach(option => {
            const source = option.getAttribute('data-source');
            if (source === rateSource) {
                option.classList.add('selected');
            } else {
                option.classList.remove('selected');
            }
        });

        // Show/Hide custom input
        if (rateSource === 'custom') {
            customRateInputContainer.style.display = 'flex';
        } else {
            customRateInputContainer.style.display = 'none';
        }
    }



    /**
     * Handle enable/disable toggle
     */
    enableToggle.addEventListener('change', (e) => {
        const isEnabled = e.target.checked;
        chrome.storage.local.set({ isEnabled }, () => {
            reloadCurrentTab();
        });
    });

    /**
     * Handle billion unit toggle
     */
    billionToggle.addEventListener('change', (e) => {
        const showBillionUnit = e.target.checked;
        chrome.storage.local.set({ showBillionUnit }, () => {
            reloadCurrentTab();
        });
    });

    /**
     * Handle trillion unit toggle
     */
    trillionToggle.addEventListener('change', (e) => {
        const showTrillionUnit = e.target.checked;
        chrome.storage.local.set({ showTrillionUnit }, () => {
            reloadCurrentTab();
        });
    });

    /**
     * Handle decimal places selection
     */
    decimalSelect.addEventListener('change', (e) => {
        const decimalPlaces = parseInt(e.target.value);
        chrome.storage.local.set({ decimalPlaces }, () => {
            reloadCurrentTab();
        });
    });

    /**
     * Handle rate source toggle button click
     */
    rateSourceToggle.addEventListener('click', () => {

        const isExpanded = rateSourceOptions.classList.contains('expanded');

        if (isExpanded) {

            rateSourceOptions.classList.remove('expanded');
            rateSourceToggle.classList.remove('active');
        } else {

            rateSourceOptions.classList.add('expanded');
            rateSourceToggle.classList.add('active');
        }
    });

    /**
     * Handle rate source option selection
     */
    rateSourceOptionElements.forEach(option => {
        option.addEventListener('click', () => {
            const rateSource = option.getAttribute('data-source');

            // Update UI immediately
            updateSelectedRateSource(rateSource);

            if (rateSource === 'custom') {
                // For custom, just show input, don't trigger refresh yet unless we have a value
                rateSourceOptions.classList.remove('expanded');
                rateSourceToggle.classList.remove('active');

                // If we already have a value, set it as active
                if (customRateInput.value) {
                    const val = parseFloat(customRateInput.value);
                    chrome.storage.local.set({
                        rateSource,
                        usdkrw: val,
                        lastFetchTime: Date.now(),
                        lastFetchStatus: 'success'
                    });
                } else {
                    // Just set user to custom mode
                    chrome.storage.local.set({ rateSource });
                }
            } else {
                // For APIs, save and refresh
                chrome.storage.local.set({ rateSource, lastFetchTime: 0 }, () => {

                    chrome.runtime.sendMessage({ action: 'refreshRate' });

                    setTimeout(() => {
                        rateSourceOptions.classList.remove('expanded');
                        rateSourceToggle.classList.remove('active');
                    }, 300);
                });
            }
        });
    });

    // ✅ 인라인 에러 메시지 툧퍼: alert() 대체
    function showInlineError(inputEl, message) {
        // 기존 에러 제거
        const existing = inputEl.parentElement.querySelector('.inline-error');
        if (existing) existing.remove();

        const err = document.createElement('span');
        err.className = 'inline-error';
        err.style.cssText = 'color:#f87171;font-size:11px;display:block;margin-top:4px;';
        err.textContent = message;
        inputEl.parentElement.appendChild(err);

        // 3초 후 자동 제거
        setTimeout(() => err.remove(), 3000);
    }

    /**
     * Handle Custom Rate Save
     */
    saveCustomRateBtn.addEventListener('click', () => {
        const val = parseFloat(customRateInput.value);
        if (isNaN(val) || val <= 0) {
            showInlineError(customRateInput, '유효한 환율을 입력해주세요.');
            return;
        }

        chrome.storage.local.set({
            rateSource: 'custom',
            customRateValue: val,
            usdkrw: val,
            lastFetchTime: Date.now(),
            lastFetchStatus: 'success'
        }, () => {

            // Feedback
            const originalText = saveCustomRateBtn.textContent;
            saveCustomRateBtn.textContent = '저장됨!';
            setTimeout(() => {
                saveCustomRateBtn.textContent = originalText;
            }, 1500);
        });
    });

    /**
     * Helper function to update DOM without full page reload
     */
    function reloadCurrentTab() {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                // Send message to content script to reload settings and update DOM
                chrome.tabs.sendMessage(tabs[0].id, { action: 'reloadSettings' }, (response) => {
                    // Ignore errors if content script is not loaded
                    if (chrome.runtime.lastError) {
                        // Content script not loaded, ignore
                    }
                });
            }
        });
    }


    // Update relative time every 10 seconds
    setInterval(() => {
        chrome.storage.local.get(['lastFetchTime'], (result) => {
            lastUpdate.textContent = PopupCore.formatRelativeTime(result.lastFetchTime);
        });
    }, 10000);

    // Update refresh timer every second
    setInterval(() => {
        chrome.storage.local.get(['rateSource', 'lastFetchTime'], (result) => {
            const rateSource = result.rateSource || 'usd_krw';
            updateRefreshTimer(rateSource, result.lastFetchTime);
        });
    }, 1000);

    // Listen for storage changes (rate updates from background)
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local') {
            // Get current rateSource to format rate correctly
            chrome.storage.local.get(['rateSource'], (result) => {
                const rateSource = result.rateSource || 'usd_krw';

                if (changes.usdkrw) {
                    rateValue.textContent = PopupCore.formatRate(changes.usdkrw.newValue, rateSource);
                }
                if (changes.rateSource) {
                    // Update rate display with new source label
                    chrome.storage.local.get(['usdkrw'], (result) => {
                        rateValue.textContent = PopupCore.formatRate(result.usdkrw || 1300, changes.rateSource.newValue);
                    });
                }
            });

            if (changes.lastFetchStatus) {
                updateStatus(changes.lastFetchStatus.newValue);
            }
            if (changes.lastFetchTime) {
                lastUpdate.textContent = PopupCore.formatRelativeTime(changes.lastFetchTime.newValue);
            }
        }
    });

    /**
     * Calculate and display Kimchi Premium
     * ✅ 수정: popup에서 직접 fetch 제거 → background가 주기적으로 저장한
     *    storage 캐시를 읽는 방식으로 변경
     */
    async function updatePremiumInfo() {
        try {
            const storage = await chrome.storage.local.get([
                'standardRate', 'usdkrw', 'rateSource', 'upbitUsdt', 'upbitUsdc'
            ]);

            const standardRate = storage.standardRate;
            const usdkrw = storage.usdkrw;

            // 표준 환율이 없으면 프리미엄 계산 불가
            if (!standardRate || !usdkrw) return;

            // Upbit 계열 옵션 내 설명에 현재 저장된 usdkrw 기반 프리미엄 표시
            // (background가 30초마다 업비트 실가를 저장하면 여기서 읽음)
            const upbitUsdt = storage.upbitUsdt; // background가 저장하면 사용, 없으면 usdkrw 대체
            const upbitUsdc = storage.upbitUsdc;

            const usdtPrice = upbitUsdt || usdkrw;
            const usdcPrice = upbitUsdc || usdkrw;

            const usdtDescEl = document.querySelector('.rate-source-option[data-source="upbit_usdt"] .option-desc');
            if (usdtDescEl) {
                const premium = PopupCore.calculatePremium(usdtPrice, standardRate);
                const sign = premium >= 0 ? '+' : '';
                usdtDescEl.textContent = `김치 프리미엄 ${sign}${premium.toFixed(2)}% (₩${usdtPrice.toLocaleString()})`;
            }

            const usdcDescEl = document.querySelector('.rate-source-option[data-source="upbit_usdc"] .option-desc');
            if (usdcDescEl) {
                const premium = PopupCore.calculatePremium(usdcPrice, standardRate);
                const sign = premium >= 0 ? '+' : '';
                usdcDescEl.textContent = `김치 프리미엄 ${sign}${premium.toFixed(2)}% (₩${usdcPrice.toLocaleString()})`;
            }

        } catch (e) {
            console.error('Failed to update premium info:', e);
        }
    }

    // ...

    // Initial Data Load
    loadData();
    updatePremiumInfo(); // Call this too

    // ==================== TABS & COPY LOGIC ====================

    // Tab Switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

            // Add active to current
            btn.classList.add('active');
            const tabId = btn.getAttribute('data-tab');
            const tabEl = document.getElementById(tabId);
            if (tabEl) {
                tabEl.classList.add('active');
            } else {
                console.error(`Tab content not found for id: ${tabId}`);
            }

            // Load sites list when Sites tab is opened
            if (tabId === 'tab-sites') {
                loadSites();
            }
        });
    });

    // Copy to Clipboard
    document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetSel = btn.getAttribute('data-clipboard-target');
            const targetEl = document.querySelector(targetSel);

            if (targetEl) {
                const text = targetEl.textContent;
                navigator.clipboard.writeText(text).then(() => {
                    // Success Feedback
                    const originalText = btn.textContent;
                    btn.textContent = '복사됨!';
                    btn.style.background = '#4CAF50';
                    btn.style.color = 'white';

                    setTimeout(() => {
                        btn.textContent = originalText;
                        btn.style.background = '';
                        btn.style.color = '';
                    }, 1500);
                }).catch(err => {
                    console.error('Copy failed', err);
                });
            }
        });
    });

    // QR Code Toggle Logic
    document.querySelectorAll('.qr-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-qr-target');
            const targetEl = document.getElementById(targetId);

            if (targetEl) {
                // Toggle display
                if (targetEl.style.display === 'none') {
                    targetEl.style.display = 'flex'; // Use flex to center
                    btn.classList.add('active');
                } else {
                    targetEl.style.display = 'none';
                    btn.classList.remove('active');
                }
            }
        });
    });

    // ==================== SITES MANAGEMENT ====================

    const DEFAULT_SITES = [
        'hyperliquid.xyz',
        'lighter.xyz',
        'binance.com',
        'okx.com',
        'bitget.com',
        'kucoin.com',
        'bingx.com'
    ];

    const sitesList = document.getElementById('sitesList');
    const newSiteInput = document.getElementById('newSiteInput');
    const addSiteBtn = document.getElementById('addSiteBtn');
    const sitesListContainer = document.getElementById('sitesListContainer');
    const modeWhitelist = document.getElementById('mode-whitelist');
    const modeAll = document.getElementById('mode-all');

    /**
     * Load and apply current site mode
     */
    function loadSiteMode() {
        chrome.storage.local.get(['applyToAllSites'], (result) => {
            const applyToAllSites = result.applyToAllSites || false;

            if (applyToAllSites) {
                modeAll.checked = true;
                sitesListContainer.classList.add('disabled');
            } else {
                modeWhitelist.checked = true;
                sitesListContainer.classList.remove('disabled');
            }
        });
    }

    /**
     * Handle site mode change
     */
    function handleModeChange(mode) {
        const applyToAllSites = mode === 'all';

        chrome.storage.local.set({ applyToAllSites }, () => {

            if (applyToAllSites) {
                sitesListContainer.classList.add('disabled');
            } else {
                sitesListContainer.classList.remove('disabled');
            }

            // Reload current tab to apply new site mode
            reloadCurrentTab();
        });
    }

    // Mode change event listeners
    if (modeWhitelist && modeAll) {
        modeWhitelist.addEventListener('change', (e) => {
            if (e.target.checked) {
                handleModeChange('whitelist');
            }
        });

        modeAll.addEventListener('change', (e) => {
            if (e.target.checked) {
                handleModeChange('all');
            }
        });
    }

    // Load current mode on startup
    loadSiteMode();

    /**
     * Render sites list
     */
    function renderSites(enabledSites) {
        if (!sitesList) return;

        // Clear existing content safely
        sitesList.innerHTML = '';

        if (enabledSites.length === 0) {
            sitesList.innerHTML = `
                <div class="empty-sites">
                    <div class="empty-sites-icon">🌐</div>
                    <div class="empty-sites-text">등록된 사이트가 없습니다</div>
                </div>
            `;
            return;
        }

        // Create document fragment for better performance
        const fragment = document.createDocumentFragment();

        enabledSites.forEach(site => {
            const siteItem = document.createElement('div');
            siteItem.className = 'site-item';
            siteItem.dataset.site = site;

            const siteInfo = document.createElement('div');
            siteInfo.className = 'site-info';

            const siteIcon = document.createElement('span');
            siteIcon.className = 'site-icon';
            siteIcon.textContent = '🌐';

            const siteName = document.createElement('span');
            siteName.className = 'site-name';
            siteName.textContent = site; // Safe: textContent escapes HTML

            siteInfo.appendChild(siteIcon);
            siteInfo.appendChild(siteName);

            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-site-btn';
            removeBtn.dataset.site = site;
            removeBtn.textContent = '제거';

            // Add event listener directly here, no need to querySelectorAll later
            removeBtn.addEventListener('click', () => {
                removeSite(site);
            });

            siteItem.appendChild(siteInfo);
            siteItem.appendChild(removeBtn);

            fragment.appendChild(siteItem);
        });

        sitesList.appendChild(fragment);
    }

    /**
     * Load and display sites
     */
    function loadSites() {
        chrome.storage.local.get(['enabledSites'], (result) => {
            const enabledSites = result.enabledSites || DEFAULT_SITES;
            renderSites(enabledSites);
        });
    }

    /**
     * Add a new site
     */
    function addSite(site) {
        site = PopupCore.validateSite(site);

        if (!site || site.length < 3) {
            // ✅ alert() → 인라인 에러
            showInlineError(newSiteInput, '유효한 사이트를 입력해주세요.');
            return;
        }

        chrome.storage.local.get(['enabledSites'], (result) => {
            const enabledSites = result.enabledSites || DEFAULT_SITES;

            if (enabledSites.includes(site)) {
                // ✅ alert() → 인라인 에러
                showInlineError(newSiteInput, '이미 등록된 사이트입니다.');
                return;
            }

            enabledSites.push(site);
            chrome.storage.local.set({ enabledSites }, () => {

                renderSites(enabledSites);
                newSiteInput.value = '';
            });
        });
    }

    /**
     * Remove a site
     */
    function removeSite(site) {
        chrome.storage.local.get(['enabledSites'], (result) => {
            let enabledSites = result.enabledSites || DEFAULT_SITES;
            enabledSites = enabledSites.filter(s => s !== site);

            chrome.storage.local.set({ enabledSites }, () => {

                renderSites(enabledSites);
            });
        });
    }

    // Add site button click
    if (addSiteBtn) {
        addSiteBtn.addEventListener('click', () => {
            addSite(newSiteInput.value);
        });
    }

    // Add site on Enter key
    if (newSiteInput) {
        newSiteInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                addSite(newSiteInput.value);
            }
        });
    }

    // Initial load if Sites tab is active
    loadSites();

    // ==================== MULTI-CURRENCY TOGGLES ====================

    const eurToggle = document.getElementById('eurToggle');
    const jpyToggle = document.getElementById('jpyToggle');
    const cnyToggle = document.getElementById('cnyToggle');

    // Load multi-currency settings
    chrome.storage.local.get(['eurEnabled', 'jpyEnabled', 'cnyEnabled'], (result) => {
        if (eurToggle) eurToggle.checked = result.eurEnabled || false;
        if (jpyToggle) jpyToggle.checked = result.jpyEnabled || false;
        if (cnyToggle) cnyToggle.checked = result.cnyEnabled || false;
    });

    // EUR toggle
    if (eurToggle) {
        eurToggle.addEventListener('change', (e) => {
            const enabled = e.target.checked;
            chrome.storage.local.set({ eurEnabled: enabled }, () => {
                reloadCurrentTab();
            });
        });
    }

    // JPY toggle (mutually exclusive with CNY)
    if (jpyToggle) {
        jpyToggle.addEventListener('change', (e) => {
            const enabled = e.target.checked;

            if (enabled) {
                // Disable CNY when JPY is enabled
                chrome.storage.local.set({
                    jpyEnabled: true,
                    cnyEnabled: false
                }, () => {
                    reloadCurrentTab();
                });
                if (cnyToggle) cnyToggle.checked = false;
            } else {
                chrome.storage.local.set({ jpyEnabled: false }, () => {
                    reloadCurrentTab();
                });
            }
        });
    }

    // CNY toggle (mutually exclusive with JPY)
    if (cnyToggle) {
        cnyToggle.addEventListener('change', (e) => {
            const enabled = e.target.checked;

            if (enabled) {
                // Disable JPY when CNY is enabled
                chrome.storage.local.set({
                    cnyEnabled: true,
                    jpyEnabled: false
                }, () => {
                    reloadCurrentTab();
                });
                if (jpyToggle) jpyToggle.checked = false;
            } else {
                chrome.storage.local.set({ cnyEnabled: false }, () => {
                    reloadCurrentTab();
                });
            }
        });
    }

    // ==================== NOTIFICATIONS ====================
    const newsNotifyToggle = document.getElementById('newsNotifyToggle');
    const testNotifyBtn = document.getElementById('testNotifyBtn');

    // Load initial state
    chrome.storage.local.get(['newsNotifyEnabled'], (result) => {
        if (newsNotifyToggle) {
            // Default to true if not set? No, let's default to false to be less intrusive, or true?
            // User asked for it, so maybe true? Let's stick to false as safe default unless user enables it.
            // Actually, for a feature user asked for, true might be better. Let's start false.
            newsNotifyToggle.checked = result.newsNotifyEnabled || false;
        }
    });

    if (newsNotifyToggle) {
        newsNotifyToggle.addEventListener('change', (e) => {
            chrome.storage.local.set({ newsNotifyEnabled: e.target.checked });
        });
    }

    if (testNotifyBtn) {
        testNotifyBtn.addEventListener('click', () => {
            // Request permission first (optional in extension but good practice)
            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icon128.png',
                title: '[KRW Master] 🇺🇸 CPI (YoY) - TEST',
                message: '실제: 3.4% / 예상: 3.2%\n(알림 테스트입니다)',
                priority: 2
            }, (notificationId) => {
                // If it fails (e.g. no permission), alert user
                if (chrome.runtime.lastError) {
                    alert('알림을 표시할 수 없습니다: ' + chrome.runtime.lastError.message);
                }
            });
        });
    }



    // ==================== ECONOMIC INDICATORS ====================
    const refreshIndicatorsBtn = document.getElementById('refreshIndicatorsBtn');
    const indicatorsList = document.getElementById('indicatorsList');

    function getImpactStars(impact) {
        if (impact === 'High') return '⭐⭐⭐';
        if (impact === 'Medium') return '⭐⭐';
        if (impact === 'Low') return '⭐';
        return '';
    }

    // Translation Dictionaries
    // Comprehensive Translation Dictionaries
    const COUNTRY_MAP = {
        // 3-Letter Codes (generated by background.js) & Common Names
        'USA': '미국', 'UNI': '미국', 'US': '미국',
        'EUR': '유럽', 'EMU': '유럽', 'EU': '유럽',
        'JPN': '일본', 'JAP': '일본', 'JP': '일본',
        'CHN': '중국', 'CHI': '중국', 'CN': '중국',
        'UK': '영국', 'GBR': '영국', 'GRE': '영국',
        'CAN': '캐나다', 'CA': '캐나다',
        'AUS': '호주', 'AU': '호주',
        'NZL': '뉴질랜드', 'NEW': '뉴질랜드', 'NZ': '뉴질랜드',
        'CHE': '스위스', 'SWI': '스위스', 'CH': '스위스',
        'KOR': '한국', 'SOU': '한국', 'KR': '한국',
        // Additional Countries
        'ARG': '아르헨티나', 'BOL': '볼리비아', 'BRA': '브라질',
        'IND': '인도', 'IDN': '인도네시아', 'MOR': '모로코',
        'EAS': '동티모르', 'SIN': '싱가포르', 'NET': '네덜란드',
        'DEN': '덴마크', 'NOR': '노르웨이', 'TUR': '튀르키예',
        'MAL': '말레이시아', 'PAL': '팔레스타인', 'TAI': '대만',
        'HON': '홍콩', 'POL': '폴란드', 'BEL': '벨기에',
        'FRA': '프랑스', 'HUN': '헝가리', 'IRE': '아일랜드',
        'LAT': '라트비아', 'MEX': '멕시코', 'COL': '콜롬비아',
        'GER': '독일', 'ITA': '이탈리아', 'SPA': '스페인',
        'POR': '포르투갈', 'SWE': '스웨덴', 'RUS': '러시아',
        'SAU': '사우디', 'ZAR': '남아공'
    };

    const TERM_MAP = [
        // Holidays & Events
        { en: /Bank Holiday/i, ko: '휴장' },
        { en: /Foundation Day/i, ko: '건국기념일' },
        { en: /World Economic Forum/i, ko: '세계경제포럼(다보스포럼)' },
        { en: /Annual Meeting/i, ko: '연례 회의' },
        { en: /Meeting/i, ko: '회의' },
        { en: /Summit/i, ko: '정상회담' },

        // Central Bank & Interest Rates
        { en: /Interest Rate Decision/i, ko: '금리 결정' },
        { en: /Monetary Policy Statement/i, ko: '통화정책 성명서' },
        { en: /Monetary Policy Meeting Accounts/i, ko: '통화정책 회의록' },
        { en: /FOMC Meeting Minutes/i, ko: 'FOMC 회의록' },
        { en: /FOMC Economic Projections/i, ko: 'FOMC 경제 전망' },
        { en: /Fed Chair .* Speaks/i, ko: '연준 의장 연설' },
        { en: /ECB President .* Speaks/i, ko: 'ECB 총재 연설' },
        { en: /BOE Gov .* Speaks/i, ko: 'BOE 총재 연설' },
        { en: /RBA Gov .* Speaks/i, ko: 'RBA 총재 연설' },
        { en: /Speaks/i, ko: '연설' },
        { en: /Minutes/i, ko: '회의록' },
        { en: /Fed Balance Sheet/i, ko: '연준 대차대조표' },
        { en: /Overnight Lending Rate/i, ko: '익일물 대출 금리' },
        { en: /Overnight Borrowing Rate/i, ko: '익일물 차입 금리' },
        { en: /Bill Auction/i, ko: '단기국채 입찰' },
        { en: /Bond Auction/i, ko: '국채 입찰' },
        { en: /Note Auction/i, ko: '국채 입찰' },
        { en: /TIPS Auction/i, ko: '물가연동국채 입찰' },
        { en: /OAT Auction/i, ko: '프랑스 국채(OAT) 입찰' },
        { en: /Gilt Auction/i, ko: '영국 국채(Gilt) 입찰' },
        { en: /Bund Auction/i, ko: '독일 국채(Bund) 입찰' },

        // Employment
        { en: /Non-Farm Employment Change/i, ko: '비농업 고용 변화' },
        { en: /Unemployment Rate/i, ko: '실업률' },
        { en: /Initial Jobless Claims/i, ko: '신규 실업수당 청구' },
        { en: /Jobless Claims 4-week Average/i, ko: '실업수당 청구 4주 평균' },
        { en: /Continuing Jobless Claims/i, ko: '연속 실업수당 청구' },
        { en: /Average Hourly Earnings/i, ko: '시간당 평균 임금' },
        { en: /Participation Rate/i, ko: '경제활동 참가율' },
        { en: /Job Openings/i, ko: '구인 건수(JOLTs)' },
        { en: /Employment Change/i, ko: '고용 변화' },
        { en: /Full Time Employment/i, ko: '풀타임 고용' },
        { en: /Part Time Employment/i, ko: '파트타임 고용' },
        { en: /Chg/i, ko: '변동' },

        // Inflation
        { en: /Core PCE Price Index/i, ko: '근원 PCE 물가지수' },
        { en: /PCE Price Index/i, ko: 'PCE 물가지수' },
        { en: /PCE Prices/i, ko: 'PCE 물가' },
        { en: /Core CPI/i, ko: '근원 소비자 물가지수' },
        { en: /CPI/i, ko: '소비자 물가지수' },
        { en: /Core PPI/i, ko: '근원 생산자 물가지수' },
        { en: /PPI/i, ko: '생산자 물가지수' },
        { en: /Inflation Rate/i, ko: '인플레이션율' },
        { en: /Inflation Expectations/i, ko: '기대 인플레이션' },
        { en: /Wholesale Prices/i, ko: '도매 물가' },
        { en: /Import Price Index/i, ko: '수입 물가지수' },
        { en: /Export Price Index/i, ko: '수출 물가지수' },

        // GDP & Economy
        { en: /GDP Growth Rate/i, ko: 'GDP 성장률' },
        { en: /GDP/i, ko: '국내총생산(GDP)' },
        { en: /Leading Indicator/i, ko: '경기 선행 지수' },
        { en: /Industrial Production/i, ko: '산업 생산' },
        { en: /Manufacturing Production/i, ko: '제조업 생산' },
        { en: /Capacity Utilization/i, ko: '설비 가동률' },
        { en: /Factory Orders/i, ko: '공장 수주' },
        { en: /Durable Goods Orders/i, ko: '내구재 수주' },
        { en: /Corporate Profits/i, ko: '기업 이익' },
        { en: /Personal Income/i, ko: '개인 소득' },
        { en: /Personal Spending/i, ko: '개인 지출' },
        { en: /Real Consumer Spending/i, ko: '실질 소비자 지출' },
        { en: /Fed Composite Index/i, ko: '연준 종합 지수' },
        { en: /Manufacturing Index/i, ko: '제조업 지수' },

        // PMI & Sentiment
        { en: /ISM Manufacturing PMI/i, ko: 'ISM 제조업 PMI' },
        { en: /ISM Non-Manufacturing PMI/i, ko: 'ISM 비제조업 PMI' },
        { en: /Services PMI/i, ko: '서비스업 PMI' },
        { en: /Manufacturing PMI/i, ko: '제조업 PMI' },
        { en: /Construction PMI/i, ko: '건설업 PMI' },
        { en: /Consumer Confidence/i, ko: '소비자 신뢰지수' },
        { en: /Consumer Sentiment/i, ko: '소비자 심리지수' },
        { en: /Economic Sentiment/i, ko: '경제 심리지수' },
        { en: /Business Confidence/i, ko: '기업 신뢰지수' },
        { en: /Business Barometer/i, ko: '기업 체감 지수' },
        { en: /CBI Distributive Trades/i, ko: 'CBI 유통 판매 지수' },

        // Housing
        { en: /Building Permits/i, ko: '건축 허가' },
        { en: /Housing Starts/i, ko: '주택 착공' },
        { en: /Existing Home Sales/i, ko: '기존 주택 판매' },
        { en: /New Home Sales/i, ko: '신규 주택 판매' },
        { en: /Pending Home Sales/i, ko: '잠정 주택 판매' },
        { en: /House Price Index/i, ko: '주택 가격 지수' },
        { en: /Housing Price Index/i, ko: '주택 가격 지수' },
        { en: /Mortgage Rate/i, ko: '모기지 금리' },

        // Trade & Balance
        { en: /Trade Balance/i, ko: '무역 수지' },
        { en: /Balance of Trade/i, ko: '무역 수지' },
        { en: /Current Account/i, ko: '경상 수지' },
        { en: /Exports/i, ko: '수출' },
        { en: /Imports/i, ko: '수입' },
        { en: /Retail Sales/i, ko: '소매 판매' },
        { en: /Wholesale Inventories/i, ko: '도매 재고' },
        { en: /Business Inventories/i, ko: '기업 재고' },
        { en: /Foreign Exchange Reserves/i, ko: '외환 보유고' },
        { en: /Money Supply/i, ko: '통화량' },

        // Energy
        { en: /Crude Oil Inventories/i, ko: '원유 재고' },
        { en: /Gasoline Inventories/i, ko: '가솔린 재고' },
        { en: /Heating Oil Stocks/i, ko: '난방유 재고' },
        { en: /Natural Gas Stocks/i, ko: '천연가스 재고' },
        { en: /Distillate Stocks/i, ko: '증류유 재고' },
        { en: /Crude Oil Imports/i, ko: '원유 수입' },
        { en: /Refinery Crude Runs/i, ko: '정유 공장 가동량' },
        { en: /Distillate Fuel Production/i, ko: '증류 연료 생산' },
        { en: /Gasoline Production/i, ko: '가솔린 생산' },

        // Modifiers & Time
        { en: /Prelim/i, ko: '(잠정)' },
        { en: /Flash/i, ko: '(속보)' },
        { en: /Final/i, ko: '(확정)' },
        { en: /Revised/i, ko: '(수정)' },
        { en: /Core/i, ko: '근원' },
        { en: /Ex-Food and Energy/i, ko: '(식품/에너지 제외)' },
        { en: /Ex Banks/i, ko: '(은행 제외)' },
        { en: /Year over Year/i, ko: '(전년비)' },
        { en: /Quarter over Quarter/i, ko: '(전분기비)' },
        { en: /Month over Month/i, ko: '(전월비)' },
        { en: /Mid-month/i, ko: '월중' },
        { en: /\(YoY\)/i, ko: '(전년비)' },
        { en: /\(QoQ\)/i, ko: '(전분기비)' },
        { en: /\(MoM\)/i, ko: '(전월비)' },
        { en: /YoY/i, ko: '(전년비)' },
        { en: /QoQ/i, ko: '(전분기비)' },
        { en: /MoM/i, ko: '(전월비)' }
    ];

    function translateText(text) {
        if (!text) return text;
        let translated = text;
        // Apply term replacements sequentially
        // Note: Specific terms should come before general terms in TERM_MAP
        TERM_MAP.forEach(term => {
            translated = translated.replace(term.en, term.ko);
        });
        return translated;
    }

    function translateCountry(country) {
        // Assume country is code (e.g. US) or name
        if (!country) return '';
        const upper = country.toUpperCase();
        return COUNTRY_MAP[upper] || COUNTRY_MAP[country] || country;
    }

    // State for filtering
    let currentEvents = [];
    let filterState = {
        impact: ['High', 'Medium', 'Low'],
        country: ['ALL']
    };

    function renderEconomicEvents(events) {
        if (!indicatorsList) return;
        indicatorsList.innerHTML = '';

        // Filter events
        const filteredEvents = events.filter(event => {
            // Impact Filter
            if (!filterState.impact.includes(event.impact)) return false;

            // Country Filter
            if (!filterState.country.includes('ALL')) {
                // Map event country to code (simple check)
                const eventCountry = translateCountry(event.country);
                // Check if any selected country matches
                // Note: accurate matching requires robust mapping. 
                // Here we try to match code or name.
                const match = filterState.country.some(code => {
                    const name = COUNTRY_MAP[code];
                    return eventCountry.includes(name) || event.country.includes(code);
                });
                if (!match) return false;
            }
            return true;
        });

        if (!filteredEvents || filteredEvents.length === 0) {
            indicatorsList.innerHTML = '<div class="loading-spinner">표시할 데이터가 없습니다</div>';
            return;
        }

        const fragment = document.createDocumentFragment();
        const now = Date.now();
        let nextEventId = null;
        let lastDateStr = '';

        filteredEvents.forEach((event, index) => {
            // Date Header Logic
            const eventDateStr = event.date; // e.g., "Jan 24, 2026" (or however parser provides it)
            if (eventDateStr !== lastDateStr) {
                const header = document.createElement('div');
                header.className = 'date-header';
                header.textContent = translateText(eventDateStr); // Apply translation if needed
                fragment.appendChild(header);
                lastDateStr = eventDateStr;
            }

            const el = document.createElement('div');
            el.className = `event-item impact-${event.impact}`;

            // Identify event after current time (autoscroll target)
            if (!nextEventId && event.timestamp > now) {
                nextEventId = `event-${index}`;
                el.id = nextEventId;
                el.classList.add('next-event'); // Visual helper
            }

            el.innerHTML = `
                <div class="event-time-box">
                    <span class="event-time">${event.time}</span>
                </div>
                <div class="event-details">
                    <div class="event-title">${translateText(event.title)}</div>
                    <div class="event-meta">
                        <span class="event-currency">${translateCountry(event.country)}</span>
                        <span class="event-impact">${getImpactStars(event.impact)}</span>
                        ${event.actual ? `<span class="event-actual" title="실제값">Act: ${event.actual}</span>` : ''}
                        ${event.forecast ? `<span class="event-forecast" title="예상값">Est: ${event.forecast}</span>` : ''}
                    </div>
                </div>
            `;
            fragment.appendChild(el);
        });

        indicatorsList.appendChild(fragment);

        // Auto-scroll logic with visibility check
        if (nextEventId) {
            setTimeout(() => {
                const target = document.getElementById(nextEventId);
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    // Visual feedback
                    target.style.transition = 'background 0.5s';
                    target.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
                    setTimeout(() => {
                        target.style.backgroundColor = '';
                    }, 2000);
                }
            }, 100);
        }
    }

    // Filter Logic
    function initFilters() {
        // Impact Checkboxes
        document.querySelectorAll('input[name="impact"]').forEach(cb => {
            cb.addEventListener('change', () => {
                filterState.impact = Array.from(document.querySelectorAll('input[name="impact"]:checked')).map(c => c.value);
                // Save to storage
                chrome.storage.local.set({ filterImpact: filterState.impact });
                renderEconomicEvents(currentEvents);
            });
        });

        // Country Chips
        document.querySelectorAll('.country-chip').forEach(chip => {
            chip.addEventListener('click', (e) => {
                const country = chip.getAttribute('data-country');

                // Toggle active class logic
                if (country === 'ALL') {
                    // Activate ALL, deactivate others
                    document.querySelectorAll('.country-chip').forEach(c => c.classList.remove('active'));
                    chip.classList.add('active');
                    filterState.country = ['ALL'];
                } else {
                    // Deactivate ALL
                    document.querySelector('.country-chip[data-country="ALL"]').classList.remove('active');

                    // Toggle current
                    chip.classList.toggle('active');

                    // Rebuild state
                    const actives = Array.from(document.querySelectorAll('.country-chip.active')).map(c => c.getAttribute('data-country'));
                    if (actives.length === 0) {
                        // If nothing selected, revert to ALL
                        document.querySelector('.country-chip[data-country="ALL"]').classList.add('active');
                        filterState.country = ['ALL'];
                    } else {
                        filterState.country = actives;
                    }
                }

                // Save to storage
                chrome.storage.local.set({ filterCountry: filterState.country });
                renderEconomicEvents(currentEvents);
            });
        });

        // Restore filters from settings
        chrome.storage.local.get(['filterImpact', 'filterCountry'], (result) => {
            if (result.filterImpact) {
                filterState.impact = result.filterImpact;
                document.querySelectorAll('input[name="impact"]').forEach(cb => {
                    cb.checked = filterState.impact.includes(cb.value);
                });
            }
            if (result.filterCountry) {
                filterState.country = result.filterCountry;
                // Update UI loops
                document.querySelectorAll('.country-chip').forEach(c => c.classList.remove('active'));
                filterState.country.forEach(code => {
                    const el = document.querySelector(`.country-chip[data-country="${code}"]`);
                    if (el) el.classList.add('active');
                });
            }
        });
    }

    // Toggle Filters UI
    const toggleFiltersBtn = document.getElementById('toggleFiltersBtn');
    const indicatorsFilterSection = document.getElementById('indicatorsFilterSection');

    if (toggleFiltersBtn && indicatorsFilterSection) {
        toggleFiltersBtn.addEventListener('click', () => {
            const isCollapsed = indicatorsFilterSection.classList.contains('collapsed');
            if (isCollapsed) {
                indicatorsFilterSection.classList.remove('collapsed');
                toggleFiltersBtn.classList.add('active');
            } else {
                indicatorsFilterSection.classList.add('collapsed');
                toggleFiltersBtn.classList.remove('active');
            }
        });
    }

    // Initialize Filters
    initFilters();

    function loadEconomicEvents() {
        if (!indicatorsList) return;

        indicatorsList.innerHTML = '<div class="loading-spinner">데이터 불러오는 중...</div>';

        chrome.runtime.sendMessage({ action: "fetchEconomicEvents" }, (response) => {
            if (response && response.success) {
                currentEvents = response.events; // Store raw data
                renderEconomicEvents(currentEvents);
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


    // ==================== DATA SYNC ====================
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace !== 'local') return;

        // Core Settings & Rate
        const coreKeys = ['usdkrw', 'customRateValue', 'isEnabled', 'showBillionUnit', 'showTrillionUnit', 'decimalPlaces', 'rateSource', 'lastFetchTime', 'lastFetchStatus', 'lastFetchError'];
        if (coreKeys.some(key => changes[key])) {
            loadData();
        }

        const premiumKeys = ['usdkrw', 'standardRate', 'upbitUsdt', 'upbitUsdc', 'rateSource'];
        if (premiumKeys.some(key => changes[key])) {
            updatePremiumInfo();
        }
        // Multi-currency Toggles
        if (changes.eurEnabled && eurToggle) eurToggle.checked = changes.eurEnabled.newValue;
        if (changes.jpyEnabled && jpyToggle) jpyToggle.checked = changes.jpyEnabled.newValue;
        if (changes.cnyEnabled && cnyToggle) cnyToggle.checked = changes.cnyEnabled.newValue;

        // Notification Toggle
        if (changes.newsNotifyEnabled && newsNotifyToggle) newsNotifyToggle.checked = changes.newsNotifyEnabled.newValue;

        // Economic Filters
        if (changes.filterImpact || changes.filterCountry) {
            if (changes.filterImpact) {
                filterState.impact = changes.filterImpact.newValue || ['High', 'Medium', 'Low'];
                document.querySelectorAll('input[name="impact"]').forEach(cb => {
                    cb.checked = filterState.impact.includes(cb.value);
                });
            }
            if (changes.filterCountry) {
                filterState.country = changes.filterCountry.newValue || ['ALL'];
                document.querySelectorAll('.country-chip').forEach(c => c.classList.remove('active'));
                filterState.country.forEach(code => {
                    const el = document.querySelector(`.country-chip[data-country="${code}"]`);
                    if (el) el.classList.add('active');
                });
            }
            renderEconomicEvents(currentEvents);
        }
    });

}); // End of DOMContentLoaded
