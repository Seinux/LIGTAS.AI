const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const state = {
    loc: null,
    units: 'metric'
};

const ICONS = { '01': '☀️', '02': '⛅', '03': '☁️', '04': '☁️', '09': '🌧️', '10': '🌦️', '11': '⛈️', '13': '❄️', '50': '🌫️' };
const icon = (code) => ICONS[String(code || '').slice(0, 2)] || '☁️';

async function api(path, options = {}) {
    const res = await fetch(path, {
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        ...options,
    });
    if (res.status === 401 || res.redirected) { window.location.href = '/login'; throw new Error('Not logged in'); }
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Request failed');
    return res.status === 204 ? null : res.json();
}


async function loadDefaultLocation() {
    const data = await api('/api/dashboard/location');

    if (!data.hasLocation) {
        window.location.href = '/location.html';
        return false;
    }

    const location = data.location;

    state.loc = {
        id: location.id,
        name: [
            location.barangay,
            location.city,
            location.province
        ].filter(Boolean).join(', '),
        region: location.region || location.countryCode,
        lat: Number(location.latitude),
        lon: Number(location.longitude)
    };

    return true;
}


const q = () => `lat=${state.loc.lat}&lon=${state.loc.lon}&units=${state.units}`;
const deg = state.units === 'metric' ? '°C' : '°F';
const time = (t, o) => new Date(t * 1000).toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', ...o });

// ---------- weather ----------
async function loadWeather() {
    const w = await api(`/api/weather?${q()}`);
    const c = w.current, metric = state.units === 'metric';

    $('locName').textContent = state.loc.name || w.location.name;
    $('coords').textContent = `${w.location.lat.toFixed(2)}° N, ${w.location.lon.toFixed(2)}° E`;
    $('dateText').textContent = new Date().toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', weekday: 'long', month: 'long', day: 'numeric' });
    $('updatedText').textContent = `${time(c.updatedAt, { hour: 'numeric', minute: '2-digit' })} PHT · Updated just now`;

    $('temp').textContent = `${c.temp}°`;
    $('cond').textContent = c.description.replace(/^./, (m) => m.toUpperCase());
    $('range').textContent = `Feels like ${c.feelsLike}° · H:${c.high}° L:${c.low}°`;
    $('bigIcon').textContent = icon(c.icon);
    $('wind').textContent = `${c.wind} ${metric ? 'm/s' : 'mph'}`;
    $('humidity').textContent = `${c.humidity}%`;
    $('visibility').textContent = metric ? `${(c.visibility / 1000).toFixed(1)} km` : `${(c.visibility / 1609).toFixed(1)} mi`;
    $('uvi').textContent = c.uvi < 3 ? `${Math.round(c.uvi)} · Low` : c.uvi < 6 ? `${Math.round(c.uvi)} · Moderate` : `${Math.round(c.uvi)} · High`;

    const a = w.alerts[0];
    $('alertCount').textContent = `${w.alerts.length} active alert${w.alerts.length === 1 ? '' : 's'}`;
    $('alertBox').className = a ? 'alert on' : 'alert';
    $('alertBox').innerHTML = a
        ? `<strong>${esc(a.event)}</strong>${esc((a.description || '').slice(0, 160))}<br><small>${esc(a.sender)}</small>`
        : '<strong>All clear</strong>No active weather alerts for this area.';

    $('hourly').innerHTML = w.hourly.slice(0, 9).map((h, i) => `
        <div class="hour"><small>${i === 0 ? 'Now' : time(h.time, { hour: 'numeric' })}</small>
        <span class="ic">${icon(h.icon)}</span><b>${h.temp}°</b><small>💧 ${h.pop}%</small></div>`).join('');

    const lo = Math.min(...w.daily.map((d) => d.low)), hi = Math.max(...w.daily.map((d) => d.high)), span = hi - lo || 1;
    $('daily').innerHTML = w.daily.map((d, i) => `
        <div class="day"><b>${i === 0 ? 'Today' : new Date(d.time * 1000).toLocaleDateString('en-PH', { weekday: 'short', timeZone: 'Asia/Manila' })}</b>
        <span>${icon(d.icon)}</span><small>${esc(d.condition)}</small><small>${d.pop}%</small>
        <small>${d.low}°</small><div class="bar"><i style="left:${((d.low - lo) / span) * 100}%;right:${100 - ((d.high - lo) / span) * 100}%"></i></div><small>${d.high}°</small></div>`).join('');
}

async function loadReports() {
    const list = await api(`/api/reports/nearby?lat=${state.loc.lat}&lon=${state.loc.lon}&radius=5`);
    $('reports').innerHTML = list.length
        ? list.map((r) => `<div class="rep"><span>${r.severity === 'info' ? '≋' : '⚠️'}</span><div><b>${esc(r.title)}</b>
            <small>${esc(r.description || '')}</small><small>${Math.max(1, Math.round((Date.now() - new Date(r.created_at)) / 60000))} min ago · ${r.distance_km} km away</small></div></div>`).join('')
        : '<small>No reports nearby in the last 24 hours.</small>';
}

// ---------- sidebar ----------
const locItem = (l, extra = '') => `<li data-lat="${l.lat}" data-lon="${l.lon}" data-name="${esc(l.name)}" data-region="${esc(l.region || '')}">
    <span><b>${esc(l.name)}</b><small>${esc(l.region || '')}</small></span>${extra}</li>`;

async function loadSidebar() {
    const [saved, recent] = await Promise.all([api(`/api/locations?units=${state.units}`), api('/api/recent-searches')]);
    $('savedList').innerHTML = saved.map((l) => locItem(l, l.temp !== undefined ? `<span class="temp">${l.temp}°</span>` : '')).join('') || '<small>No saved locations yet.</small>';
    $('recentList').innerHTML = recent.map((l) => locItem(l)).join('');
    document.querySelectorAll('#savedList li').forEach((li) => li.classList.toggle('active', Number(li.dataset.lat) === state.loc.lat && Number(li.dataset.lon) === state.loc.lon));
}

function pick(li) {
    state.loc = { name: li.dataset.name, region: li.dataset.region, lat: Number(li.dataset.lat), lon: Number(li.dataset.lon) };
    $('searchResults').classList.add('hidden');
    refresh();
}

async function refresh() {
    if (!state.loc) return;

    try {
        await Promise.all([
            loadWeather(),
            loadReports(),
            loadSidebar()
        ]);
    } catch (e) {
        console.error(e);
        $('locName').textContent = 'Could not load data';
    }
}

// ---------- events ----------
['savedList', 'recentList', 'searchResults'].forEach((id) =>
    $(id).addEventListener('click', (e) => { const li = e.target.closest('li[data-lat]'); if (li) pick(li); }));

let timer;
$('searchInput').addEventListener('input', (e) => {
    clearTimeout(timer);
    const v = e.target.value.trim();
    if (v.length < 2) return $('searchResults').classList.add('hidden');
    timer = setTimeout(async () => {
        try {
            const res = await api(`/api/places/search?q=${encodeURIComponent(v)}`);
            $('searchResults').innerHTML = res.map((l) => locItem(l)).join('') || '<small>No results.</small>';
            $('searchResults').classList.remove('hidden');
            $('searchResults').onclick = async (ev) => {
                const li = ev.target.closest('li[data-lat]'); if (!li) return;
                await api('/api/recent-searches', { method: 'POST', body: JSON.stringify({ name: li.dataset.name, region: li.dataset.region, lat: li.dataset.lat, lon: li.dataset.lon }) });
                pick(li);
            };
        } catch (err) { console.error(err); }
    }, 300);
});

$('useLocation').addEventListener('click', () => {
    window.location.href = '/location';
});

$('saveCurrent').addEventListener('click', async () => {
    try { await api('/api/locations', { method: 'POST', body: JSON.stringify(state.loc) }); loadSidebar(); }
    catch (e) { alert(e.message); }
});

$('reportBtn').addEventListener('click', async () => {
    const title = prompt('What are you seeing? (e.g. "Roadside flooding on Commonwealth Ave")');
    if (!title) return;
    try {
        await api('/api/reports', { method: 'POST', body: JSON.stringify({ title, severity: 'warning', lat: state.loc.lat, lon: state.loc.lon }) });
        loadReports();
    } catch (e) { alert(e.message); }
});

function setUnits(u) {
    state.units = u;
    $('unitF').classList.toggle('active', u === 'imperial');
    $('unitC').classList.toggle('active', u === 'metric');
    refresh();
}
$('unitF').addEventListener('click', () => setUnits('imperial'));
$('unitC').addEventListener('click', () => setUnits('metric'));

// NOTE: change '/auth/logout' if your authRoutes uses a different path.
$('logoutButton').addEventListener('click', async () => {
    try { await fetch('/auth/logout', { method: 'POST', credentials: 'same-origin' }); } finally { window.location.href = '/login'; }
});

async function initializeDashboard() {
    try {
        const hasLocation = await loadDefaultLocation();

        if (!hasLocation) return;

        await refresh();

    } catch (error) {
        console.error('Dashboard initialization error:', error);
        $('locName').textContent = 'Unable to load dashboard';
    }
}

initializeDashboard();