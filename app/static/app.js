/* Taskflow UI — no build step or frontend dependencies required. */
'use strict';

const API = '/api/v1/tasks';
const $ = (selector) => document.querySelector(selector);
const icons = (name) => `<svg class="icon"><use href="#i-${name}"></use></svg>`;
const STATUS = {todo: 'To do', in_progress: 'In progress', done: 'Done'};
const PRIORITY = {low: 'Low priority', medium: 'Medium priority', high: 'High priority'};
const state = {tasks: [], stats: null, nav: 'overview', view: 'board', editing: null, loading: true, fetchVersion: 0};
let lastFocused = null;
let searchTimer = null;

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));
}
function localToday() {
  const now = new Date();
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
}
function formattedDate(value) {
  if (!value) return 'No due date';
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric'});
}
function isFormTarget(target) {
  return target instanceof HTMLElement && (target.matches('input, textarea, select') || target.isContentEditable);
}
async function api(path = '', options = {}) {
  let response;
  try {
    response = await fetch(API + path, {
      ...options,
      headers: {...(options.body ? {'Content-Type': 'application/json'} : {}), ...(options.headers || {})},
    });
  } catch (_err) {
    throw new Error('Could not connect to the server. Check that FastAPI is running.');
  }
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    const detail = data?.detail;
    const message = Array.isArray(detail) ? detail.map(e => e.msg).join('; ') : detail;
    throw new Error(typeof message === 'string' ? message : `Request failed (${response.status})`);
  }
  return response.status === 204 ? null : response.json();
}

function toast(message, error = false) {
  const node = document.createElement('div');
  node.className = `toast${error ? ' error' : ''}`;
  node.innerHTML = `${icons(error ? 'close' : 'check-circle')}<span>${escapeHTML(message)}</span>`;
  $('#toast-stack').append(node);
  setTimeout(() => node.remove(), 4300);
}
function showAlert(message) {
  $('#inline-alert-text').textContent = message;
  $('#inline-alert').hidden = false;
}
function hideAlert() { $('#inline-alert').hidden = true; }
function setLoading() {
  state.loading = true;
  $('#board-content').className = 'kanban-board';
  $('#board-content').innerHTML = '<div class="loading-state"><span class="loading-spinner"></span> Loading your tasks...</div>';
  $('#list-content').hidden = true;
}
async function loadStats() {
  try {
    const stats = await api('/stats');
    state.stats = stats;
    $('#metric-total').textContent = stats.total;
    $('#metric-progress').textContent = stats.in_progress;
    $('#metric-done').textContent = stats.done;
    $('#nav-total').textContent = stats.total;
    $('#side-progress').textContent = stats.in_progress;
    $('#side-todo').textContent = stats.todo;
    $('#side-done').textContent = stats.done;
    $('#donut-percent').textContent = `${stats.completion_rate}%`;
    $('#donut').style.background = `conic-gradient(#fff 0 ${stats.completion_rate}%,rgba(255,255,255,.21) ${stats.completion_rate}% 100%)`;
    $('#donut').setAttribute('aria-label', `${stats.completion_rate} percent of tasks completed`);
    $('#momentum-message').textContent = stats.total === 0 ? 'Every great project starts with one task.' : stats.done === stats.total ? 'All caught up. Enjoy your well-earned win!' : `${stats.done} of ${stats.total} tasks completed. Keep going!`;
  } catch (error) {
    showAlert(error.message);
  }
}
function activeParams() {
  const p = new URLSearchParams();
  const search = $('#search').value.trim();
  if (search) p.set('search', search);
  if ($('#priority-filter').value) p.set('priority', $('#priority-filter').value);
  if (state.nav === 'completed') p.set('status', 'done');
  p.set('sort', $('#sort-select').value);
  p.set('limit', '100');
  return p;
}
async function loadTasks(showSpinner = false) {
  const version = ++state.fetchVersion;
  if (showSpinner) setLoading();
  hideAlert();
  const params = activeParams();
  const output = [];
  try {
    for (let offset = 0; ; offset += 100) {
      params.set('offset', String(offset));
      const chunk = await api(`?${params}`);
      if (version !== state.fetchVersion) return;
      output.push(...chunk);
      if (chunk.length < 100) break;
    }
    state.tasks = output;
    state.loading = false;
    renderTasks();
  } catch (error) {
    if (version !== state.fetchVersion) return;
    state.loading = false;
    state.tasks = [];
    renderTasks();
    showAlert(error.message);
  }
}
function updateFiltersUI() {
  $('#clear-filters').hidden = !($('#search').value || $('#priority-filter').value || $('#sort-select').value !== 'newest');
}
function dueHTML(task) {
  const today = localToday();
  const overdue = task.due_date && task.due_date < today && task.status !== 'done';
  const dueToday = task.due_date === today && task.status !== 'done';
  const className = overdue ? 'overdue' : dueToday ? 'today-due' : '';
  const label = overdue ? 'Overdue · ' + formattedDate(task.due_date) : dueToday ? 'Due today' : formattedDate(task.due_date);
  return `<span class="due-badge ${className}">${icons('calendar')}<span>${escapeHTML(label)}</span></span>`;
}
function priorityHTML(priority) {
  return `<span class="priority-pill ${priority}">${icons('flag')} ${PRIORITY[priority]}</span>`;
}
function cardHTML(task) {
  return `<article class="task-card" tabindex="0" draggable="true" role="button" aria-label="Edit ${escapeHTML(task.title)}" data-task-id="${task.id}">
    <div class="card-topline">${priorityHTML(task.priority)}<span class="task-id">#${String(task.id).padStart(3, '0')}</span></div>
    <h3 class="card-title">${escapeHTML(task.title)}</h3>
    <p class="card-description">${escapeHTML(task.description || 'No description added yet.')}</p>
    <div class="card-divider"></div>
    <div class="card-footer">${dueHTML(task)}<select class="card-status-select" data-status-id="${task.id}" aria-label="Change status of ${escapeHTML(task.title)}">${Object.entries(STATUS).map(([value, label]) => `<option value="${value}" ${task.status === value ? 'selected' : ''}>${label}</option>`).join('')}</select></div>
  </article>`;
}
function emptyColumnHTML() {
  return `<div class="empty-column"><span class="empty-mini">${icons('inbox')}</span><strong>Nothing here yet</strong><span>Drop a task here or create one.</span></div>`;
}
function columnHTML(status, title, tasks) {
  return `<section class="kanban-column" data-column="${status}" aria-label="${title} column"><div class="column-header"><span class="column-title"><span class="column-dot ${status}"></span>${title}</span><span class="column-count">${tasks.length}</span></div><div class="column-cards">${tasks.length ? tasks.map(cardHTML).join('') : emptyColumnHTML()}</div><button class="column-add" data-add-status="${status}">${icons('plus')} Add a task</button></section>`;
}
function globalEmptyHTML() {
  const filtered = Boolean($('#search').value || $('#priority-filter').value || state.nav === 'completed');
  return `<div class="empty-global"><div class="empty-globe">${icons(filtered ? 'search' : 'spark')}</div><h3>${filtered ? 'No matching tasks' : 'A fresh start, just for you'}</h3><p>${filtered ? 'Nothing matches these filters. Try a different search or clear the filters.' : 'Your best work starts with a plan. Create your first task, or explore the app with a few examples.'}</p><div class="empty-actions"><button class="primary-button" data-action="${filtered ? 'reset-filters' : 'add-empty'}">${icons(filtered ? 'close' : 'plus')} ${filtered ? 'Clear filters' : 'Create a task'}</button>${filtered ? '' : '<button class="cancel-button" data-action="sample-tasks" style="margin-left:8px">Try sample tasks</button>'}</div></div>`;
}
function listHTML(tasks) {
  if (!tasks.length) return `<div class="list-empty">No tasks found. Try adjusting your filters.</div>`;
  return `<div class="list-row list-head"><span>Task</span><span>Status</span><span>Priority</span><span>Due date</span><span>Task ID</span></div>${tasks.map(task => `<div class="list-row" role="button" tabindex="0" data-task-id="${task.id}" aria-label="Edit ${escapeHTML(task.title)}"><span class="list-title">${escapeHTML(task.title)}</span><span class="list-status">${STATUS[task.status]}</span>${priorityHTML(task.priority)}<span>${escapeHTML(formattedDate(task.due_date))}</span><span>#${task.id}</span></div>`).join('')}`;
}
function renderTasks() {
  updateFiltersUI();
  const tasks = state.tasks;
  const title = state.nav === 'completed' ? 'Completed tasks' : 'Your task board';
  $('#board').querySelector('h2').firstChild.textContent = title + ' ';
  $('#board-total').textContent = tasks.length;
  $('#footer-summary').textContent = `${tasks.length} ${tasks.length === 1 ? 'task' : 'tasks'} ${state.nav === 'completed' ? 'completed' : 'in this view'}`;
  const board = $('#board-content');
  if (!tasks.length) {
    board.className = 'kanban-board';
    board.innerHTML = globalEmptyHTML();
  } else if (state.nav === 'completed') {
    board.className = 'kanban-board';
    board.style.gridTemplateColumns = 'minmax(0,1fr)';
    board.innerHTML = columnHTML('done', 'Done', tasks);
  } else {
    board.style.gridTemplateColumns = '';
    board.className = 'kanban-board';
    board.innerHTML = Object.entries(STATUS).map(([status, title]) => columnHTML(status, title, tasks.filter(task => task.status === status))).join('');
  }
  const list = $('#list-content');
  list.innerHTML = listHTML(tasks);
  board.hidden = state.view !== 'board';
  list.hidden = state.view !== 'list';
}
function setView(view) {
  state.view = view;
  $('#board-view').classList.toggle('selected', view === 'board');
  $('#list-view').classList.toggle('selected', view === 'list');
  $('#board-view').setAttribute('aria-pressed', String(view === 'board'));
  $('#list-view').setAttribute('aria-pressed', String(view === 'list'));
  $('#board-content').hidden = view !== 'board';
  $('#list-content').hidden = view !== 'list';
}
function closeMobileNav() { $('#sidebar').classList.remove('open'); $('#mobile-scrim').hidden = true; }
function navigate(page) {
  state.nav = page;
  document.querySelectorAll('[data-nav]').forEach(b => b.classList.toggle('active', b.dataset.nav === page));
  $('#current-page').textContent = ({overview: 'Overview', all: 'All tasks', completed: 'Completed', insights: 'Insights'})[page];
  closeMobileNav();
  if (page === 'insights') { $('#overview-top').scrollIntoView({behavior: 'smooth', block: 'center'}); return; }
  if (page === 'completed' || page === 'all') $('#board').scrollIntoView({behavior: 'smooth', block: 'start'});
  else window.scrollTo({top: 0, behavior: 'smooth'});
  loadTasks(true);
}

function openDrawer(task = null, defaultStatus = 'todo') {
  state.editing = task?.id || null;
  lastFocused = document.activeElement;
  $('#task-form').reset();
  $('#task-title').value = task?.title || '';
  $('#task-desc').value = task?.description || '';
  $('#task-status').value = task?.status || defaultStatus;
  $('#task-priority').value = task?.priority || 'medium';
  $('#task-due').value = task?.due_date || '';
  $('#drawer-heading').textContent = task ? 'Edit task' : 'Create a task';
  $('#save-task').innerHTML = task ? `Save changes ${icons('check')}` : `Create task ${icons('arrow-up-right')}`;
  $('#delete-task').hidden = !task;
  $('#form-error').hidden = true;
  $('#drawer-overlay').hidden = false;
  $('#task-drawer').hidden = false;
  $('#task-drawer').setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => $('#task-title').focus());
}
function closeDrawer() {
  $('#drawer-overlay').hidden = true;
  $('#task-drawer').hidden = true;
  $('#task-drawer').setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  state.editing = null;
  if (lastFocused?.isConnected) lastFocused.focus();
}
function showFormError(message) { $('#form-error').textContent = message; $('#form-error').hidden = false; }
async function submitTask(event) {
  event.preventDefault();
  const title = $('#task-title').value.trim();
  if (!title || title.length > 120) { showFormError('Enter a task name between 1 and 120 characters.'); $('#task-title').focus(); return; }
  const description = $('#task-desc').value.trim();
  const payload = {title, description: description || null, status: $('#task-status').value, priority: $('#task-priority').value, due_date: $('#task-due').value || null};
  const button = $('#save-task');
  button.disabled = true;
  const editing = state.editing;
  try {
    await api(editing ? `/${editing}` : '', {method: editing ? 'PATCH' : 'POST', body: JSON.stringify(payload)});
    closeDrawer();
    toast(editing ? 'Task updated successfully' : 'Task created successfully');
    await Promise.all([loadTasks(), loadStats()]);
  } catch (error) {
    showFormError(error.message);
  } finally { button.disabled = false; }
}
function showConfirm() { $('#confirm-overlay').hidden = false; $('#confirm-cancel').focus(); }
function hideConfirm() { $('#confirm-overlay').hidden = true; $('#delete-task').focus(); }
async function deleteTask() {
  if (!state.editing) return;
  const button = $('#confirm-delete');
  button.disabled = true;
  try {
    await api(`/${state.editing}`, {method: 'DELETE'});
    $('#confirm-overlay').hidden = true;
    closeDrawer();
    toast('Task deleted');
    await Promise.all([loadTasks(), loadStats()]);
  } catch (error) { toast(error.message, true); }
  finally { button.disabled = false; }
}
async function changeStatus(id, status) {
  try {
    await api(`/${id}`, {method: 'PATCH', body: JSON.stringify({status})});
    toast(`Moved to ${STATUS[status]}`);
    await Promise.all([loadTasks(), loadStats()]);
  } catch (error) { toast(error.message, true); await loadTasks(); }
}
const SAMPLE_TASKS = [
  {title: 'Plan the weekly priorities', description: 'Pick three important outcomes to focus on this week.', priority: 'high', status: 'todo'},
  {title: 'Review project milestones', description: 'Check the roadmap and share progress with the team.', priority: 'medium', status: 'todo'},
  {title: 'Design the dashboard experience', description: 'Refine layouts, component states, and responsive styles.', priority: 'high', status: 'in_progress'},
  {title: 'Document API endpoints', description: 'Add clear examples for request and response payloads.', priority: 'medium', status: 'in_progress'},
  {title: 'Set up the project workspace', description: 'Create the repository and organize the development environment.', priority: 'low', status: 'done'},
];
async function addSamples() {
  if (state.stats?.total) return toast('Sample tasks can only be added to an empty workspace.', true);
  const button = $('[data-action="sample-tasks"]');
  if (button) button.disabled = true;
  try {
    await Promise.all(SAMPLE_TASKS.map(task => api('', {method: 'POST', body: JSON.stringify(task)})));
    toast('Five example tasks added. Explore the board!');
    await Promise.all([loadTasks(), loadStats()]);
  } catch (error) { toast(error.message, true); await Promise.all([loadTasks(), loadStats()]); }
}
function csvCell(value) {
  let text = String(value ?? '');
  if (/^[=+\-@]/.test(text.trimStart())) text = "'" + text; // Avoid spreadsheet formula injection.
  return `"${text.replaceAll('"', '""')}"`;
}
function exportCSV() {
  if (!state.tasks.length) return toast('There are no tasks to export.', true);
  const headers = ['ID','Title','Description','Status','Priority','Due Date','Created At'];
  const rows = state.tasks.map(t => [t.id,t.title,t.description,t.status,t.priority,t.due_date,t.created_at]);
  const csv = '\uFEFF' + [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], {type: 'text/csv;charset=utf-8;'}));
  const a = document.createElement('a');
  a.href = url; a.download = `taskflow-tasks-${localToday()}.csv`;
  document.body.append(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  toast('CSV export ready');
}
function onTaskClick(event) {
  const action = event.target.closest('[data-action]');
  if (action) {
    if (action.dataset.action === 'reset-filters') { $('#search').value = ''; $('#priority-filter').value = ''; $('#sort-select').value = 'newest'; navigate('all'); }
    if (action.dataset.action === 'add-empty') openDrawer();
    if (action.dataset.action === 'sample-tasks') addSamples();
    return;
  }
  const add = event.target.closest('[data-add-status]');
  if (add) { openDrawer(null, add.dataset.addStatus); return; }
  if (event.target.closest('select')) return;
  const card = event.target.closest('[data-task-id]');
  if (card) { const task = state.tasks.find(t => t.id === Number(card.dataset.taskId)); if (task) openDrawer(task); }
}
function trapFocus(event, root) {
  if (event.key !== 'Tab') return;
  const nodes = [...root.querySelectorAll('button:not([disabled]):not([hidden]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])')].filter(n => n.offsetParent !== null);
  if (!nodes.length) return;
  const first = nodes[0], last = nodes[nodes.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}
function init() {
  $('#today-label').textContent = new Date().toLocaleDateString(undefined, {weekday: 'short', month: 'short', day: 'numeric'});
  const dark = localStorage.getItem('taskflow-theme') === 'dark';
  document.body.classList.toggle('dark', dark);
  $('#theme-switch').innerHTML = icons(dark ? 'sun' : 'moon');
  $('#theme-switch').addEventListener('click', () => {
    const on = document.body.classList.toggle('dark');
    localStorage.setItem('taskflow-theme', on ? 'dark' : 'light');
    $('#theme-switch').innerHTML = icons(on ? 'sun' : 'moon');
  });
  document.querySelectorAll('[data-nav]').forEach(node => node.addEventListener('click', () => navigate(node.dataset.nav)));
  $('#mobile-menu').addEventListener('click', () => { $('#sidebar').classList.add('open'); $('#mobile-scrim').hidden = false; });
  $('#mobile-scrim').addEventListener('click', closeMobileNav);
  ['#hero-add','#sidebar-add'].forEach(s => $(s).addEventListener('click', () => openDrawer()));
  $('#board-view').addEventListener('click', () => setView('board'));
  $('#list-view').addEventListener('click', () => setView('list'));
  $('#priority-filter').addEventListener('change', () => loadTasks(true));
  $('#sort-select').addEventListener('change', () => loadTasks(true));
  $('#search').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => loadTasks(true), 260); });
  $('#clear-filters').addEventListener('click', () => { $('#search').value = ''; $('#priority-filter').value = ''; $('#sort-select').value = 'newest'; loadTasks(true); });
  $('#retry-button').addEventListener('click', () => { loadTasks(true); loadStats(); });
  $('#export-button').addEventListener('click', exportCSV);
  $('#board-content').addEventListener('click', onTaskClick);
  $('#list-content').addEventListener('click', onTaskClick);
  ['#board-content','#list-content'].forEach(sel => {
    $(sel).addEventListener('keydown', event => {
      if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('[data-task-id]')) { event.preventDefault(); const t = state.tasks.find(t => t.id === Number(event.target.dataset.taskId)); if (t) openDrawer(t); }
    });
  });
  $('#board-content').addEventListener('change', event => {
    const select = event.target.closest('[data-status-id]');
    if (select) changeStatus(Number(select.dataset.statusId), select.value);
  });
  $('#board-content').addEventListener('dragstart', event => {
    const card = event.target.closest('[data-task-id]');
    if (!card) return;
    event.dataTransfer.setData('text/plain', card.dataset.taskId);
    event.dataTransfer.effectAllowed = 'move';
    card.classList.add('dragging');
  });
  $('#board-content').addEventListener('dragend', () => document.querySelectorAll('.kanban-column').forEach(n => n.classList.remove('drag-over')));
  $('#board-content').addEventListener('dragover', event => {
    const col = event.target.closest('[data-column]');
    if (!col || state.nav === 'completed') return;
    event.preventDefault();
    document.querySelectorAll('.kanban-column').forEach(n => n.classList.toggle('drag-over', n === col));
  });
  $('#board-content').addEventListener('drop', event => {
    const col = event.target.closest('[data-column]');
    if (!col) return;
    event.preventDefault();
    document.querySelectorAll('.kanban-column').forEach(n => n.classList.remove('drag-over'));
    const id = Number(event.dataTransfer.getData('text/plain'));
    const task = state.tasks.find(t => t.id === id);
    if (task && task.status !== col.dataset.column) changeStatus(id, col.dataset.column);
  });
  $('#task-form').addEventListener('submit', submitTask);
  ['#drawer-close','#drawer-cancel','#drawer-overlay'].forEach(s => $(s).addEventListener('click', closeDrawer));
  $('#delete-task').addEventListener('click', showConfirm);
  $('#confirm-cancel').addEventListener('click', hideConfirm);
  $('#confirm-delete').addEventListener('click', deleteTask);
  $('#confirm-overlay').addEventListener('click', event => { if (event.target === $('#confirm-overlay')) hideConfirm(); });
  window.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      if (!$('#confirm-overlay').hidden) hideConfirm();
      else if (!$('#task-drawer').hidden) closeDrawer();
      else closeMobileNav();
      return;
    }
    if (!$('#confirm-overlay').hidden) return trapFocus(event, $('.confirm-card'));
    if (!$('#task-drawer').hidden) return trapFocus(event, $('#task-drawer'));
    if (event.ctrlKey || event.metaKey || event.altKey || isFormTarget(event.target)) return;
    if (event.key.toLowerCase() === 'n') { event.preventDefault(); openDrawer(); }
    if (event.key === '/') { event.preventDefault(); $('#search').focus(); $('#board').scrollIntoView({behavior:'smooth'}); }
  });
  setView('board');
  loadStats();
  loadTasks(true);
}

document.addEventListener('DOMContentLoaded', init);
