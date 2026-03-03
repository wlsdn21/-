// Background Script

"use strict";

importScripts('logger.js');


const FX_APIS = [
    "https://open.er-api.com/v6/latest/USD",
    "https://api.exchangerate-api.com/v4/latest/USD",
    "https://api.exchangerate.host/latest?base=USD"
];

const UPBIT_API = "https://api.upbit.com/v1/ticker?markets=KRW-USDT,KRW-USDC";

const RATE_SOURCE = {
    USD_KRW: 'usd_krw',
    UPBIT_USDT: 'upbit_usdt',
    UPBIT_USDC: 'upbit_usdc',
    CUSTOM: 'custom'
};

const DEFAULT_RATE = 1300;

// Different refresh intervals for different rate sources
const REFRESH_INTERVALS = {
    USD_KRW: 30 * 1000,           // 30 seconds
    UPBIT_USDT: 30 * 1000,         // 30 seconds
    UPBIT_USDC: 30 * 1000,          // 30 seconds
    CUSTOM: 0                      // No auto refresh for custom
};


const ALARM_NAME = "fetchExchangeRate";
const ECONOMIC_ALARM_NAME = "fetchEconomicEvents";
const ECONOMIC_FEED_URL = "https://www.myfxbook.com/rss/forex-economic-calendar-events";

/**
 * Parser for Myfxbook RSS Feed
 * Structure: <item><title>...</title><description>HTML Table...</description></item>
 */
class EconomicCalendarParser {
    static parse(xmlText) {
        const events = [];
        const itemRegex = /<item>([\s\S]*?)<\/item>/g;

        let match;
        while ((match = itemRegex.exec(xmlText)) !== null) {
            const content = match[1];

            const title = this._extractTag(content, 'title');
            const link = this._extractTag(content, 'link');
            const pubDateStr = this._extractTag(content, 'pubDate');
            const description = this._extractTag(content, 'description');

            // Extract Impact from HTML Description
            // Class: "sprite-high-impact", "sprite-medium-impact", "sprite-low-impact"
            let impact = 'Low';
            if (description.includes('sprite-high-impact')) impact = 'High';
            else if (description.includes('sprite-medium-impact')) impact = 'Medium';
            else if (description.includes('sprite-low-impact')) impact = 'Low';
            else if (description.includes('sprite-no-impact')) impact = 'Low';

            // Extract Numeric Data
            let previous = '', forecast = '', actual = '';

            // Matches &#60;td&#62; value &#60;/td&#62; OR &lt;td&gt; value &lt;/td&gt;
            const cellRegex = /(?:&#60;|&lt;)td(?:&#62;|&gt;)([\s\S]*?)(?:&#60;|&lt;)\/td(?:&#62;|&gt;)/gi;
            const cells = [];
            let cellMatch;
            while ((cellMatch = cellRegex.exec(description)) !== null) {
                cells.push(cellMatch[1].trim());
            }

            if (cells.length >= 5) {
                previous = cells[2];
                forecast = cells[3];
                actual = cells[4];
            } else {
                // Try standard HTML tags fallback
                const stdCellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
                const stdCells = [];
                let stdMatch;
                while ((stdMatch = stdCellRegex.exec(description)) !== null) {
                    stdCells.push(stdMatch[1].trim());
                }
                if (stdCells.length >= 5) {
                    previous = stdCells[2];
                    forecast = stdCells[3];
                    actual = stdCells[4];
                }
            }

            // Cleanup whitespace
            previous = previous.replace(/\s+/g, ' ').trim();
            forecast = forecast.replace(/\s+/g, ' ').trim();
            actual = actual.replace(/\s+/g, ' ').trim();

            // Parse Date
            const dateObj = new Date(pubDateStr);

            const date = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const time = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

            // Extract Country from Link
            let country = 'Global';
            const linkMatch = link.match(/forex-economic-calendar\/([^\/]+)\//);
            if (linkMatch && linkMatch[1]) {
                country = linkMatch[1].charAt(0).toUpperCase() + linkMatch[1].slice(1);
            }

            events.push({
                title,
                country: country.substring(0, 3).toUpperCase(),
                date,
                time,
                impact,
                previous,
                forecast,
                actual,
                timestamp: dateObj.getTime()
            });
        }

        return events;
    }

    static _extractTag(content, tagName) {
        const regex = new RegExp(`<${tagName}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tagName}>`, 'i');
        const match = regex.exec(content);
        return match ? match[1].trim() : '';
    }
}





chrome.runtime.onInstalled.addListener(() => {


    // Set default preferences
    // Check and set default preferences only if they don't exist
    chrome.storage.local.get([
        'isEnabled', 'showBillionUnit', 'decimalPlaces', 'rateSource', 'usdkrw', 'lastFetchTime',
        'eurEnabled', 'jpyEnabled', 'cnyEnabled'
    ], (result) => {
        const updates = {};
        let needsUpdate = false;

        if (result.isEnabled === undefined) {
            updates.isEnabled = true;
            needsUpdate = true;
        }
        if (result.showBillionUnit === undefined) {
            updates.showBillionUnit = true;
            needsUpdate = true;
        }
        if (result.decimalPlaces === undefined) {
            updates.decimalPlaces = 2;
            needsUpdate = true;
        }

        // Multi-currency support (default: all OFF)
        if (result.eurEnabled === undefined) {
            updates.eurEnabled = false;
            needsUpdate = true;
        }
        if (result.jpyEnabled === undefined) {
            updates.jpyEnabled = false;
            needsUpdate = true;
        }
        if (result.cnyEnabled === undefined) {
            updates.cnyEnabled = false;
            needsUpdate = true;
        }

        // Initialize optional values if needed

        if (result.lastFetchTime === undefined) {
            // Optional: reset if missing, but better to leave it alone or set 0 to force fetch just once
            // updates.lastFetchTime = 0; 
            // needsUpdate = true;
        }

        if (needsUpdate) {

            chrome.storage.local.set(updates);
        } else {

        }
    });

    // Fetch rate immediately
    fetchExchangeRate();

    // Set up periodic alarm (1 minute interval, actual rate limiting is in fetchExchangeRate)
    chrome.alarms.create(ALARM_NAME, { periodInMinutes: 1.0 });

    // ✅ 경제 이벤트: fetchEconomicEvents() 내부에서 스마트 스케줄링으로 알람을 직접 관리
    // onInstalled에서는 최초 1회 호출만 → 이후 알람 재스케줄은 함수 내부에서 처리
    fetchEconomicEvents();
});


chrome.runtime.onStartup.addListener(() => {

    // Fetch rate immediately
    fetchExchangeRate();

    // Ensure alarm is set (1 minute interval)
    chrome.alarms.create(ALARM_NAME, { periodInMinutes: 1.0 });

    // ✅ 경제 이벤트 알람은 fetchEconomicEvents() 내부에서 관리
    // onStartup에서는 캐시가 있으면 바로 쓰고, 없으면 새로 가져오게 getEconomicEvents() 호출
    getEconomicEvents().catch(console.error);
});

/**
 * Handle alarm for periodic rate updates
 */
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_NAME) {
        fetchExchangeRate();
    } else if (alarm.name === ECONOMIC_ALARM_NAME) {
        fetchEconomicEvents();
    }
});

/**
 * Handle manual refresh requests from popup
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "refreshRate") {
        fetchExchangeRate().then(rate => {
            sendResponse({ success: true, rate });
        }).catch(error => {
            sendResponse({ success: false, error: error.message });
        });
        return true; // Keep channel open for async response
    }

    if (request.action === "getStatus") {
        chrome.storage.local.get([
            'usdkrw', 'lastFetchTime', 'lastFetchStatus', 'standardRate'
        ], (result) => {
            sendResponse({
                rate: result.usdkrw || DEFAULT_RATE,
                lastUpdate: result.lastFetchTime,
                status: result.lastFetchStatus || 'unknown',
                // ✅ popup의 김치 프리미엄 계산에 필요한 standardRate 포함
                standardRate: result.standardRate || null
            });
        });
        return true;
    }

    if (request.action === "fetchEconomicEvents") {
        getEconomicEvents().then(events => {
            sendResponse({ success: true, events });
        }).catch(error => {
            sendResponse({ success: false, error: error.message });
        });
        return true;
    }
});



const MANANA_API = "https://api.manana.kr/exchange/rate.json?base=USD&code=KRW";


async function fetchMananaRate() {

    const response = await fetch(MANANA_API);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    // Data format: [{"date":"...","name":"KRWUSD=X","rate":0.000678...,"timestamp":"..."}]
    if (Array.isArray(data) && data.length > 0 && data[0].rate) {
        // The API returns KRW/USD rate (approx 0.00067), so we invert it to get USD/KRW
        const rate = 1 / data[0].rate;

        return rate;
    } else {
        throw new Error('Invalid Manana rate data');
    }
}


async function fetchUpbitRate(market) {
    const response = await fetch(UPBIT_API);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const ticker = data.find(t => t.market === market);

    if (ticker && ticker.trade_price && typeof ticker.trade_price === 'number' && ticker.trade_price > 0) {
        return ticker.trade_price;
    } else {
        throw new Error('Invalid Upbit rate data');
    }
}


async function fetchUsdKrwRate(startIndex = 0) {
    // Try all APIs starting from last successful one
    for (let i = 0; i < FX_APIS.length; i++) {
        const apiIndex = (startIndex + i) % FX_APIS.length;
        const apiUrl = FX_APIS[apiIndex];

        try {


            const response = await fetch(apiUrl);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            const rate = data?.rates?.KRW;

            if (rate && typeof rate === 'number' && rate > 0) {


                await chrome.storage.local.set({
                    currentApiIndex: apiIndex
                });

                return rate;
            } else {
                throw new Error('Invalid rate data');
            }
        } catch (error) {
            Logger.error('fetchUsdKrwRate', `API ${apiIndex + 1} failed`, {
                apiUrl: FX_APIS[apiIndex],
                error: error.message
            });
            // Continue to next API
        }
    }

    throw new Error('All USD/KRW APIs failed');
}



async function fetchExchangeRate() {


    const storage = await chrome.storage.local.get(['rateSource', 'currentApiIndex', 'usdkrw', 'lastFetchTime']);
    const rateSource = storage.rateSource || RATE_SOURCE.USD_KRW;
    const startIndex = storage.currentApiIndex || 0;
    const lastFetchTime = storage.lastFetchTime || 0;

    // Check if enough time has passed based on rate source
    // Skip time check if this is the first fetch (lastFetchTime is 0 or undefined)
    const refreshInterval = REFRESH_INTERVALS[rateSource] || REFRESH_INTERVALS.USD_KRW;
    const timeSinceLastFetch = Date.now() - lastFetchTime;

    if (lastFetchTime > 0 && timeSinceLastFetch < refreshInterval) {
        const remainingTime = Math.ceil((refreshInterval - timeSinceLastFetch) / 1000 / 60);

        return storage.usdkrw || DEFAULT_RATE;
    }

    try {
        let rate;
        let sourceLabel;
        let standardRate = storage.standardRate; // Existing standard rate

        // Helper to fetch standard rate if needed
        const updateStandardRate = async () => {
            try {
                const sRate = await fetchMananaRate();
                standardRate = sRate;
                await chrome.storage.local.set({ standardRate: sRate, lastStandardFetch: Date.now() });

            } catch (e) {
                Logger.warn('updateStandardRate', 'Failed to update standard rate', {
                    error: e.message
                });
            }
        };

        // If standard rate is missing or old (>1 hour), force update it (asynchronously)
        if (!standardRate || (Date.now() - (storage.lastStandardFetch || 0) > 60 * 60 * 1000)) {
            updateStandardRate();
        }

        switch (rateSource) {
            case RATE_SOURCE.CUSTOM:

                rate = storage.customRateValue || DEFAULT_RATE;
                sourceLabel = 'Custom Value';
                // Custom rate doesn't need API fetch
                break;

            case RATE_SOURCE.UPBIT_USDT:

                rate = await fetchUpbitRate('KRW-USDT');
                sourceLabel = 'Upbit USDT';
                // Also update standard rate if we can, to show accurate premium
                if (!standardRate) await updateStandardRate();
                // ✅ 실시간 업비트 시세를 storage에 캐시 → popup이 fetch 없이 읽음
                await chrome.storage.local.set({ upbitUsdt: rate });
                break;

            case RATE_SOURCE.UPBIT_USDC:

                rate = await fetchUpbitRate('KRW-USDC');
                sourceLabel = 'Upbit USDC';
                if (!standardRate) await updateStandardRate();
                // ✅ 실시간 업비트 시세를 storage에 캐시 → popup이 fetch 없이 읽음
                await chrome.storage.local.set({ upbitUsdc: rate });
                break;

            case RATE_SOURCE.USD_KRW:
            default:


                // Try Manana (Real-time) first
                try {
                    rate = await fetchMananaRate();
                    sourceLabel = 'USD/KRW (Real-time)';
                    // This IS the standard rate
                    standardRate = rate;
                    await chrome.storage.local.set({ standardRate: rate, lastStandardFetch: Date.now() });
                } catch (e) {
                    Logger.warn('fetchExchangeRate', 'Manana API failed, falling back to standard APIs', {
                        error: e.message,
                        fallbackApis: FX_APIS
                    });
                    // Fallback to standard APIs
                    rate = await fetchUsdKrwRate(startIndex);
                    sourceLabel = 'USD/KRW (Standard)';
                    standardRate = rate;
                    await chrome.storage.local.set({ standardRate: rate, lastStandardFetch: Date.now() });
                }
                break;
        }

        // Fetch additional currency rates (EUR, JPY, CNY)
        let eurKrw = 0, jpyKrw = 0, cnyKrw = 0;
        try {
            // Use any available API to get exchange rates
            const apiIndex = storage.currentApiIndex || 0;
            const apiUrl = FX_APIS[apiIndex];
            const response = await fetch(apiUrl);

            if (response.ok) {
                const data = await response.json();
                const rates = data.rates;

                if (rates) {
                    // Calculate EUR → KRW
                    if (rates.EUR && rates.KRW) {
                        eurKrw = (1 / rates.EUR) * rates.KRW;
                    }

                    // Calculate JPY → KRW
                    if (rates.JPY && rates.KRW) {
                        jpyKrw = (1 / rates.JPY) * rates.KRW;
                    }

                    // Calculate CNY → KRW
                    if (rates.CNY && rates.KRW) {
                        cnyKrw = (1 / rates.CNY) * rates.KRW;
                    }
                }
            }
        } catch (e) {
            console.warn('[KRW Master] Failed to fetch additional currency rates:', e);
            // Use default rates if fetch fails
            eurKrw = rate * 1.1;   // Approximate: 1 EUR ≈ 1.1 USD
            jpyKrw = rate * 0.0067; // Approximate: 100 JPY ≈ 0.67 USD
            cnyKrw = rate * 0.14;   // Approximate: 1 CNY ≈ 0.14 USD
        }


        await chrome.storage.local.set({
            usdkrw: rate,
            eurkrw: eurKrw,
            jpykrw: jpyKrw,
            cnykrw: cnyKrw,
            lastFetchTime: Date.now(),
            lastFetchStatus: 'success'
        });

        return rate;


    } catch (error) {
        Logger.error('fetchExchangeRate', `Failed to fetch rate for ${rateSource}`, {
            rateSource,
            error: error.message,
            lastFetchTime: storage.lastFetchTime
        });

        // Fallback strategy
        if (rateSource !== RATE_SOURCE.USD_KRW) {
            Logger.warn('fetchExchangeRate', 'Upbit API failed, trying USD/KRW fallback', {
                originalRateSource: rateSource
            });

            try {
                const rate = await fetchUsdKrwRate(startIndex);


                await chrome.storage.local.set({
                    usdkrw: rate,
                    lastFetchTime: Date.now(),
                    lastFetchStatus: 'success',
                    lastFetchError: null  // Clear error on success
                });

                return rate;
            } catch (fallbackError) {
                Logger.error('fetchExchangeRate', 'Fallback to USD/KRW also failed', {
                    originalRateSource: rateSource,
                    fallbackError: fallbackError.message
                });
            }
        }

        // Ultimate fallback - use cached or default rate
        const fallbackRate = storage.usdkrw || DEFAULT_RATE;
        Logger.error('fetchExchangeRate', 'All APIs failed, using fallback rate', {
            fallbackType: storage.usdkrw ? 'cached' : 'default',
            fallbackRate,
            originalError: error.message
        });

        await chrome.storage.local.set({
            lastFetchTime: Date.now(),
            lastFetchStatus: 'failed',
            lastFetchError: error.message  // Save error message
        });

        return fallbackRate;
    }
}

/**
 * Fetch economic calendar events
 */
/**
 * Get economic events, preferring cache if recent
 */
async function getEconomicEvents() {
    // Try cache first
    const storage = await chrome.storage.local.get(['economicEvents', 'lastEconomicFetch']);
    const now = Date.now();

    // Use cache if it exists and is less than 5 minutes old
    // OR if we just want to show something quickly while the alarm handles updates
    if (storage.economicEvents && storage.economicEvents.length > 0) {
        // Optional: Trigger background fetch if data is stale (> 30 mins) but return cache immediately
        if (!storage.lastEconomicFetch || (now - storage.lastEconomicFetch > 30 * 60 * 1000)) {
            fetchEconomicEvents().catch(console.error);
        }
        return storage.economicEvents;
    }

    // If no cache, force fetch
    return fetchEconomicEvents();
}

/**
 * Fetch economic calendar events
 */
async function fetchEconomicEvents(isRetry = false, retryCount = 0) {
    try {
        const response = await fetch(ECONOMIC_FEED_URL);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const xmlText = await response.text();
        const events = EconomicCalendarParser.parse(xmlText);

        // Check for updates to trigger notifications
        const storage = await chrome.storage.local.get(['economicEvents', 'newsNotifyEnabled']);
        const previousEvents = storage.economicEvents || [];
        const isNotifyEnabled = storage.newsNotifyEnabled || false;

        if (isNotifyEnabled && previousEvents.length > 0) {
            events.forEach(newEvent => {
                // Find corresponding event in previous data
                // Matching by Title + Timestamp + Currency (to be safe)
                const oldEvent = previousEvents.find(e =>
                    e.title === newEvent.title &&
                    e.timestamp === newEvent.timestamp &&
                    e.currency === newEvent.currency
                );

                // Check if 'Actual' has appeared (Old was empty, New has value)
                // Also check if impact is High
                if (oldEvent && (!oldEvent.actual || oldEvent.actual.trim() === '') &&
                    (newEvent.actual && newEvent.actual.trim() !== '')) {

                    if (newEvent.impact === 'High') {
                        // Trigger Notification
                        Logger.info('fetchEconomicEvents', `Notification Trigger: ${newEvent.title}`);

                        const title = `[KRW Master] ${newEvent.country} ${newEvent.title}`;
                        const message = `실제: ${newEvent.actual} (예상: ${newEvent.forecast || '-'})`;

                        chrome.notifications.create(newEvent.id || `news-${Date.now()}`, {
                            type: 'basic',
                            iconUrl: 'icon128.png',
                            title: title,
                            message: message,
                            priority: 2
                        });
                    }
                }
            });
        }

        await chrome.storage.local.set({
            economicEvents: events,
            lastEconomicFetch: Date.now()
        });

        // Determine next action
        const now = Date.now();

        // Check if there is a "Pending Event" 
        // (Event that happened recently (within 5 mins) but has NO actual value yet)
        const pendingEvent = events.find(e =>
            e.timestamp <= now &&
            e.timestamp > (now - 5 * 60 * 1000) &&
            (!e.actual || e.actual.trim() === '')
        );

        if (pendingEvent) {
            // Rapid Polling Mode
            // Limit to ~3 minutes (60 retries * 3s = 180s)
            if (retryCount < 60) {
                Logger.info('fetchEconomicEvents', `Pending event found (${pendingEvent.title}), polling in 3s... (Attempt ${retryCount + 1}/60)`);
                setTimeout(() => fetchEconomicEvents(true, retryCount + 1), 3000);
                return; // Exit here, don't schedule alarm yet
            } else {
                Logger.warn('fetchEconomicEvents', `Stopped polling for ${pendingEvent.title} after 60 attempts`);
            }
        }

        Logger.info('fetchEconomicEvents', `Fetched ${events.length} events from Myfxbook`);

        // Smart Scheduling: Find next event time and schedule alarm
        // Find first event in the future
        const nextEvent = events.find(e => e.timestamp > now);

        let nextFetchDelayInMinutes = 60; // Default 1 hour

        if (nextEvent) {
            // Schedule EXACTLY at the event time (no buffer)
            const targetTime = nextEvent.timestamp;
            const diffMs = targetTime - now;

            if (diffMs > 0) {
                // Determine minutes to wait
                nextFetchDelayInMinutes = Math.ceil(diffMs / 1000 / 60);

                // If it's too far (e.g. > 6 hours), revert to standard polling just in case
                if (nextFetchDelayInMinutes > 360) {
                    nextFetchDelayInMinutes = 60;
                }
            } else {
                // Should not happen if logic is correct, but safe fallback
                nextFetchDelayInMinutes = 1;
            }
        }

        Logger.info('fetchEconomicEvents', `Next fetch scheduled in ${nextFetchDelayInMinutes} minutes`);
        chrome.alarms.create(ECONOMIC_ALARM_NAME, { delayInMinutes: nextFetchDelayInMinutes });

        return events;

    } catch (error) {
        Logger.error('fetchEconomicEvents', 'Failed to fetch economic events', {
            error: error.message
        });

        // Fallback to cache if available
        const storage = await chrome.storage.local.get(['economicEvents']);
        if (storage.economicEvents && storage.economicEvents.length > 0) {
            return storage.economicEvents;
        }

        throw error;
    }
}

// ✅ 최상위 즉시 실행 제거
// Service Worker는 이벤트 드리븐으로 동작해야 함.
// 환율 갱신은 onInstalled / onStartup / chrome.alarms 에서만 트리거됨.
