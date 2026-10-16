/**
 * Student Information Management System (SIMS)
 * Client Application Logic
 */

(function () {
  'use strict';

  // ==========================================
  // Configuration & State (Centralized API Base)
  // ==========================================
  // Production Render Backend URL
  const RENDER_BACKEND_URL = 'https://student-management-sytem-2ehv.onrender.com';
  const LOCAL_BACKEND_URL = 'http://localhost:5000';
  const STORAGE_KEY_API = 'SIMS_API_BASE_URL';

  // Environment Detection:
  // Detect if running on localhost / 127.0.0.1 / file:// vs hosted in production (e.g. Netlify)
  const isLocalHost = 
    window.location.hostname === 'localhost' || 
    window.location.hostname === '127.0.0.1' || 
    window.location.protocol === 'file:';

  const DEFAULT_API_BASE = isLocalHost ? LOCAL_BACKEND_URL : RENDER_BACKEND_URL;

  // Resolve initial API base URL:
  // When running on Netlify, clear outdated local/dummy endpoints so the client automatically connects
  // to the live Render backend.
  function getInitialApiBaseUrl() {
    const saved = (localStorage.getItem(STORAGE_KEY_API) || '').trim();
    if (!isLocalHost && (!saved || saved.includes('localhost') || saved.includes('127.0.0.1') || saved.includes('student-management-api.onrender.com'))) {
      localStorage.removeItem(STORAGE_KEY_API);
      return RENDER_BACKEND_URL;
    }
    return saved || DEFAULT_API_BASE;
  }

  let apiBaseUrl = getInitialApiBaseUrl();
  let students = [];
  let isBackendOnline = false;
  let studentToDelete = null;
  let viewingStudent = null;

  let currentFilters = {
    search: '',
    department: 'all',
    semester: 'all',
    sortBy: 'id-asc'
  };

  // ==========================================
  // DOM Elements Cache
  // ==========================================
  const DOM = {
    // API Status & Configuration
    apiStatusPill: document.getElementById('apiStatusPill'),
    apiStatusDot: document.getElementById('apiStatusDot'),
    apiStatusLabel: document.getElementById('apiStatusLabel'),
    openApiSettingsBtn: document.getElementById('openApiSettingsBtn'),

    // Top Action Buttons
    refreshBtn: document.getElementById('refreshBtn'),
    openAddStudentModalBtn: document.getElementById('openAddStudentModalBtn'),

    // Stats
    statTotalStudents: document.getElementById('statTotalStudents'),
    statDepartmentCount: document.getElementById('statDepartmentCount'),
    statTopDepartment: document.getElementById('statTopDepartment'),
    statAvgSemester: document.getElementById('statAvgSemester'),
    statDbStatus: document.getElementById('statDbStatus'),
    statDbInfo: document.getElementById('statDbInfo'),

    // Filters & Search
    studentSearchInput: document.getElementById('studentSearchInput'),
    clearSearchBtn: document.getElementById('clearSearchBtn'),
    departmentFilterSelect: document.getElementById('departmentFilterSelect'),
    semesterFilterSelect: document.getElementById('semesterFilterSelect'),
    sortBySelect: document.getElementById('sortBySelect'),
    recordsCountBadge: document.getElementById('recordsCountBadge'),
    filterActiveTag: document.getElementById('filterActiveTag'),
    resetFiltersBtn: document.getElementById('resetFiltersBtn'),

    // Table & States
    tableCard: document.getElementById('tableCard'),
    studentsTableBody: document.getElementById('studentsTableBody'),
    loadingState: document.getElementById('loadingState'),
    emptyBox: document.getElementById('emptyBox'),
    emptyAddBtn: document.getElementById('emptyAddBtn'),

    // Student Add/Edit Modal
    studentModal: document.getElementById('studentModal'),
    studentForm: document.getElementById('studentForm'),
    modalTitle: document.getElementById('modalTitle'),
    modalActionIcon: document.getElementById('modalActionIcon'),
    saveBtnText: document.getElementById('saveBtnText'),
    closeStudentModalBtn: document.getElementById('closeStudentModalBtn'),
    cancelFormBtn: document.getElementById('cancelFormBtn'),
    formOriginalId: document.getElementById('formOriginalId'),

    // Form Fields
    formStudentId: document.getElementById('formStudentId'),
    formName: document.getElementById('formName'),
    formEmail: document.getElementById('formEmail'),
    formDepartment: document.getElementById('formDepartment'),
    formSemester: document.getElementById('formSemester'),
    formContact: document.getElementById('formContact'),

    // Error Labels
    studentIdError: document.getElementById('studentIdError'),
    nameError: document.getElementById('nameError'),
    emailError: document.getElementById('emailError'),
    departmentError: document.getElementById('departmentError'),
    semesterError: document.getElementById('semesterError'),
    contactError: document.getElementById('contactError'),

    // View Modal
    viewModal: document.getElementById('viewModal'),
    viewModalBody: document.getElementById('viewModalBody'),
    closeViewModalBtn: document.getElementById('closeViewModalBtn'),
    closeViewDetailsBtn: document.getElementById('closeViewDetailsBtn'),
    editFromViewModalBtn: document.getElementById('editFromViewModalBtn'),

    // Delete Modal
    deleteModal: document.getElementById('deleteModal'),
    deleteStudentDisplayName: document.getElementById('deleteStudentDisplayName'),
    deleteStudentDisplayId: document.getElementById('deleteStudentDisplayId'),
    confirmDeleteBtn: document.getElementById('confirmDeleteBtn'),
    cancelDeleteBtn: document.getElementById('cancelDeleteBtn'),

    // API Settings Modal
    apiSettingsModal: document.getElementById('apiSettingsModal'),
    apiUrlInput: document.getElementById('apiUrlInput'),
    closeApiSettingsBtn: document.getElementById('closeApiSettingsBtn'),
    cancelApiSettingsBtn: document.getElementById('cancelApiSettingsBtn'),
    saveApiSettingsBtn: document.getElementById('saveApiSettingsBtn'),
    setLocalApiPreset: document.getElementById('setLocalApiPreset'),
    setRenderApiPreset: document.getElementById('setRenderApiPreset'),
    testApiConnectionBtn: document.getElementById('testApiConnectionBtn'),
    apiTestResult: document.getElementById('apiTestResult'),

    // Toast Container
    toastContainer: document.getElementById('toastContainer')
  };

  // ==========================================
  // Helper Utilities
  // ==========================================

  function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function getInitials(name) {
    if (!name) return 'ST';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  // Toast Notification System
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconClass = 'fa-solid fa-circle-info';
    if (type === 'success') iconClass = 'fa-solid fa-circle-check';
    if (type === 'error') iconClass = 'fa-solid fa-circle-exclamation';

    toast.innerHTML = `
      <i class="${iconClass} toast-icon"></i>
      <div class="toast-message">${escapeHTML(message)}</div>
      <button type="button" class="toast-close" aria-label="Dismiss message">
        <i class="fa-solid fa-xmark"></i>
      </button>
    `;

    DOM.toastContainer.appendChild(toast);

    const closeBtn = toast.querySelector('.toast-close');
    const dismiss = () => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 200ms ease';
      setTimeout(() => {
        if (toast.parentElement) toast.parentElement.removeChild(toast);
      }, 200);
    };

    closeBtn.addEventListener('click', dismiss);
    setTimeout(dismiss, 4500);
  }

  // ==========================================
  // API Communication (REST Endpoints)
  // ==========================================

  /**
   * Health Check: GET /health
   */
  async function checkApiHealth() {
    DOM.apiStatusDot.className = 'status-indicator status-checking';
    DOM.apiStatusLabel.textContent = 'Checking API...';

    try {
      const response = await fetch(`${apiBaseUrl}/health`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      isBackendOnline = true;
      DOM.apiStatusDot.className = 'status-indicator status-online';
      DOM.apiStatusLabel.textContent = 'API Connected';
      
      if (DOM.statDbStatus) {
        if (data.databaseStatus === 'connected') {
          DOM.statDbStatus.textContent = 'Live';
          DOM.statDbStatus.className = 'stat-value text-emerald';
        } else {
          DOM.statDbStatus.textContent = 'Standby';
          DOM.statDbStatus.className = 'stat-value';
        }
      }
      return true;
    } catch (err) {
      console.warn('API Health Check failed:', err);
      isBackendOnline = false;
      DOM.apiStatusDot.className = 'status-indicator status-offline';
      DOM.apiStatusLabel.textContent = 'API Offline';
      if (DOM.statDbStatus) {
        DOM.statDbStatus.textContent = 'Offline';
        DOM.statDbStatus.className = 'stat-value';
        if (DOM.statDbInfo) DOM.statDbInfo.textContent = 'Check backend server';
      }
      return false;
    }
  }

  /**
   * Fetch All Students: GET /api/students
   * Reads student records from response.data according to API format:
   * { "success": true, "count": N, "data": [...] }
   */
  async function fetchStudents() {
    DOM.loadingState.style.display = 'flex';
    DOM.tableCard.style.display = 'none';
    DOM.emptyBox.style.display = 'none';

    try {
      let response = await fetch(`${apiBaseUrl}/api/students`, {
        method: 'GET',
        headers: { 
          'Accept': 'application/json' 
        },
      });

      // If /api/students returns 404, fallback to /students in case backend is mounted at root
      if (response.status === 404) {
        try {
          const fallbackResponse = await fetch(`${apiBaseUrl}/students`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
          });
          if (fallbackResponse.ok) {
            response = fallbackResponse;
          }
        } catch (_) {
          // Keep original response
        }
      }

      // Handle HTTP error responses gracefully before parsing JSON
      if (!response.ok) {
        let serverMsg = '';
        try {
          const errData = await response.json();
          serverMsg = errData && errData.message ? errData.message : '';
        } catch (_) {
          // Response body was not JSON
        }

        if (response.status === 503) {
          showToast(serverMsg || 'Database not connected. Please verify database connection on backend.', 'error');
        } else if (response.status === 404) {
          showToast(`API endpoint not found (HTTP 404) at ${apiBaseUrl}/api/students. Check backend routes.`, 'error');
        } else {
          showToast(serverMsg || `Backend server returned HTTP ${response.status} (${response.statusText || 'Error'}).`, 'error');
        }
        students = [];
        updateStats();
        renderTable();
        return;
      }

      const result = await response.json();

      // Read student records reliably from response.data
      if (result && Array.isArray(result.data)) {
        students = result.data;
      } else if (Array.isArray(result)) {
        students = result;
      } else if (result && result.students && Array.isArray(result.students)) {
        students = result.students;
      } else {
        students = [];
      }

      updateStats();
      renderTable();
    } catch (err) {
      console.warn('API error fetching students:', err);

      // Provide clear, contextual troubleshooting guidance
      const isMixedContent = window.location.protocol === 'https:' && apiBaseUrl.startsWith('http://');
      let friendlyMessage = '';

      if (isMixedContent) {
        friendlyMessage = `Mixed Content Blocked: Netlify (HTTPS) cannot access insecure HTTP API (${apiBaseUrl}). Use https:// in API Base URL.`;
      } else if (apiBaseUrl.includes('localhost') && !isLocalHost) {
        friendlyMessage = `Cannot reach localhost (${apiBaseUrl}) from live Netlify. Configure your Render API URL in Settings (gear icon).`;
      } else {
        friendlyMessage = `Cannot reach Backend API at ${apiBaseUrl} (${err.message || 'Failed to fetch'}). Free-tier Render services sleep on inactivity and take ~50s to wake up.`;
      }

      showToast(friendlyMessage, 'error');
      students = [];
      updateStats();
      renderTable();
    } finally {
      DOM.loadingState.style.display = 'none';
    }
  }

  /**
   * Safe response parser that extracts backend JSON or produces clear, actionable error messages
   * when servers return HTML (such as Netlify/Render 404 or 502/503 cold-start pages).
   */
  async function handleApiResponse(response, actionDescription) {
    let rawText = '';
    let parsed = null;

    try {
      rawText = await response.text();
      parsed = JSON.parse(rawText);
    } catch (_) {
      // Server returned a non-JSON response (e.g. HTML 404 / 502 / 503)
      if (response.status === 404) {
        throw new Error(
          `API endpoint not found (HTTP 404) at ${response.url || apiBaseUrl}. ` +
          `The server returned HTML instead of JSON. Please ensure your Backend API URL is configured correctly ` +
          `in Settings (gear icon in header) and that your backend server is deployed and running.`
        );
      } else if (response.status === 502 || response.status === 503 || response.status === 504) {
        throw new Error(
          `Backend server is temporarily unavailable (HTTP ${response.status}) at ${apiBaseUrl}. ` +
          `Free-tier Render services sleep on inactivity and take ~50 seconds to wake up. Please wait a moment and try again.`
        );
      } else {
        throw new Error(
          `Server at ${apiBaseUrl} returned HTTP ${response.status} (${response.statusText || 'Error'}) ` +
          `with an unparseable (HTML) response. Please check your backend server.`
        );
      }
    }

    if (!response.ok || !parsed.success) {
      throw new Error(parsed.message || `Failed to ${actionDescription} (HTTP ${response.status})`);
    }

    return parsed;
  }

  /**
   * Create Student: POST /api/students
   */
  async function apiCreateStudent(studentData) {
    let response;
    try {
      response = await fetch(`${apiBaseUrl}/api/students`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(studentData),
      });
    } catch (netErr) {
      throw new Error(`Network failure connecting to ${apiBaseUrl}: ${netErr.message || 'Failed to fetch'}`);
    }

    return await handleApiResponse(response, 'create student');
  }

  /**
   * Update Student: PUT /api/students/:id
   */
  async function apiUpdateStudent(studentId, studentData) {
    let response;
    try {
      response = await fetch(`${apiBaseUrl}/api/students/${encodeURIComponent(studentId)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(studentData),
      });
    } catch (netErr) {
      throw new Error(`Network failure connecting to ${apiBaseUrl}: ${netErr.message || 'Failed to fetch'}`);
    }

    return await handleApiResponse(response, 'update student');
  }

  /**
   * Delete Student: DELETE /api/students/:id
   */
  async function apiDeleteStudent(studentId) {
    let response;
    try {
      response = await fetch(`${apiBaseUrl}/api/students/${encodeURIComponent(studentId)}`, {
        method: 'DELETE',
        headers: { 
          'Accept': 'application/json' 
        },
      });
    } catch (netErr) {
      throw new Error(`Network failure connecting to ${apiBaseUrl}: ${netErr.message || 'Failed to fetch'}`);
    }

    return await handleApiResponse(response, 'delete student');
  }

  // ==========================================
  // Statistics & Calculation
  // ==========================================

  function updateStats() {
    if (!DOM.statTotalStudents) return;
    const total = students.length;
    DOM.statTotalStudents.textContent = total;

    if (total === 0) {
      DOM.statDepartmentCount.textContent = '0';
      DOM.statTopDepartment.textContent = 'No records';
      DOM.statAvgSemester.textContent = '0.0';
      return;
    }

    // Unique departments
    const deptMap = {};
    let totalSem = 0;

    students.forEach(s => {
      if (s.department) {
        deptMap[s.department] = (deptMap[s.department] || 0) + 1;
      }
      if (s.semester) {
        totalSem += Number(s.semester);
      }
    });

    const depts = Object.keys(deptMap);
    DOM.statDepartmentCount.textContent = depts.length;

    // Top department
    if (depts.length > 0) {
      let topDept = depts[0];
      let maxCount = deptMap[topDept];
      for (const d of depts) {
        if (deptMap[d] > maxCount) {
          topDept = d;
          maxCount = deptMap[d];
        }
      }
      DOM.statTopDepartment.textContent = `Top: ${topDept} (${maxCount})`;
    } else {
      DOM.statTopDepartment.textContent = 'No records';
    }

    // Average semester
    const avgSem = (totalSem / total).toFixed(1);
    DOM.statAvgSemester.textContent = avgSem;
  }

  // ==========================================
  // Filtering & Rendering
  // ==========================================

  function getFilteredStudents() {
    let list = [...students];

    // Filter by Search (studentId or name)
    if (currentFilters.search) {
      const q = currentFilters.search.toLowerCase().trim();
      list = list.filter(s => 
        (s.studentId && s.studentId.toLowerCase().includes(q)) ||
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.email && s.email.toLowerCase().includes(q)) ||
        (s.department && s.department.toLowerCase().includes(q))
      );
    }

    // Filter by Department
    if (currentFilters.department !== 'all') {
      list = list.filter(s => s.department === currentFilters.department);
    }

    // Filter by Semester
    if (currentFilters.semester !== 'all') {
      list = list.filter(s => String(s.semester) === String(currentFilters.semester));
    }

    // Sort
    switch (currentFilters.sortBy) {
      case 'id-asc':
        list.sort((a, b) => (a.studentId || '').localeCompare(b.studentId || ''));
        break;
      case 'name-asc':
        list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        break;
      case 'sem-asc':
        list.sort((a, b) => (Number(a.semester) || 0) - (Number(b.semester) || 0));
        break;
      case 'sem-desc':
        list.sort((a, b) => (Number(b.semester) || 0) - (Number(a.semester) || 0));
        break;
      case 'newest':
        list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        break;
      default:
        break;
    }

    return list;
  }

  function renderTable() {
    const filtered = getFilteredStudents();
    const count = filtered.length;

    DOM.recordsCountBadge.textContent = `${count} ${count === 1 ? 'Student' : 'Students'}`;

    const hasFilters = 
      currentFilters.search !== '' ||
      currentFilters.department !== 'all' ||
      currentFilters.semester !== 'all';
    DOM.filterActiveTag.style.display = hasFilters ? 'inline-block' : 'none';

    if (count === 0) {
      DOM.tableCard.style.display = 'none';
      DOM.emptyBox.style.display = 'flex';
      return;
    }

    DOM.emptyBox.style.display = 'none';
    DOM.tableCard.style.display = 'block';

    const rowsHtml = filtered.map(student => {
      const contactDisplay = student.contact ? escapeHTML(student.contact) : '<span class="text-light">N/A</span>';

      return `
        <tr data-id="${escapeHTML(student.studentId)}">
          <td>
            <span class="student-id-tag">
              <i class="fa-solid fa-id-badge"></i>
              ${escapeHTML(student.studentId)}
            </span>
          </td>
          <td>
            <span class="student-name-bold">${escapeHTML(student.name)}</span>
          </td>
          <td class="student-email-cell">
            ${escapeHTML(student.email)}
          </td>
          <td>
            <span class="dept-badge">${escapeHTML(student.department)}</span>
          </td>
          <td>
            <span class="sem-pill">
              <i class="fa-solid fa-graduation-cap"></i>
              Sem ${escapeHTML(student.semester)}
            </span>
          </td>
          <td class="contact-text">
            ${contactDisplay}
          </td>
          <td class="text-right">
            <div class="table-actions">
              <button type="button" class="btn-action btn-action-view" data-action="view" data-id="${escapeHTML(student.studentId)}" title="View Student Details">
                <i class="fa-regular fa-eye"></i>
              </button>
              <button type="button" class="btn-action btn-action-edit" data-action="edit" data-id="${escapeHTML(student.studentId)}" title="Edit Student Record">
                <i class="fa-regular fa-pen-to-square"></i>
              </button>
              <button type="button" class="btn-action btn-action-delete" data-action="delete" data-id="${escapeHTML(student.studentId)}" title="Delete Student Record">
                <i class="fa-regular fa-trash-can"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    DOM.studentsTableBody.innerHTML = rowsHtml;
  }

  // ==========================================
  // Form Validation & Modal Management
  // ==========================================

  function clearFormErrors() {
    [
      DOM.studentIdError, DOM.nameError, DOM.emailError,
      DOM.departmentError, DOM.semesterError, DOM.contactError
    ].forEach(el => {
      if (el) el.textContent = '';
    });

    const errorContainers = DOM.studentForm.querySelectorAll('.input-with-icon.has-error');
    errorContainers.forEach(el => el.classList.remove('has-error'));
  }

  function setFieldError(inputEl, errorEl, msg) {
    if (errorEl) errorEl.textContent = msg;
    const parent = inputEl.closest('.input-with-icon');
    if (parent) parent.classList.add('has-error');
  }

  function openAddModal() {
    clearFormErrors();
    DOM.studentForm.reset();
    DOM.formOriginalId.value = '';
    DOM.modalTitle.textContent = 'Add New Student';
    DOM.saveBtnText.textContent = 'Save';
    DOM.modalActionIcon.innerHTML = '<i class="fa-solid fa-user-plus"></i>';
    DOM.formStudentId.disabled = false;

    DOM.studentModal.classList.add('open');
    DOM.studentModal.setAttribute('aria-hidden', 'false');
    DOM.formStudentId.focus();
  }

  function openEditModal(studentId) {
    const student = students.find(s => s.studentId === studentId);
    if (!student) return;

    clearFormErrors();
    DOM.studentForm.reset();
    DOM.formOriginalId.value = student.studentId;
    DOM.modalTitle.textContent = 'Edit Student Information';
    DOM.saveBtnText.textContent = 'Save';
    DOM.modalActionIcon.innerHTML = '<i class="fa-solid fa-user-pen"></i>';

    DOM.formStudentId.value = student.studentId;
    DOM.formStudentId.disabled = false; // Allow modifying if desired
    DOM.formName.value = student.name || '';
    DOM.formEmail.value = student.email || '';
    DOM.formDepartment.value = student.department || '';
    DOM.formSemester.value = student.semester || '';
    DOM.formContact.value = student.contact || '';

    DOM.studentModal.classList.add('open');
    DOM.studentModal.setAttribute('aria-hidden', 'false');
    DOM.formName.focus();
  }

  function closeStudentModal() {
    DOM.studentModal.classList.remove('open');
    DOM.studentModal.setAttribute('aria-hidden', 'true');
    clearFormErrors();
  }

  // Handle Form Submission (Add or Edit)
  async function handleStudentFormSubmit(e) {
    e.preventDefault();
    clearFormErrors();

    const studentId = DOM.formStudentId.value.trim().toUpperCase();
    const name = DOM.formName.value.trim();
    const email = DOM.formEmail.value.trim();
    const department = DOM.formDepartment.value.trim();
    const semester = DOM.formSemester.value.trim();
    const contact = DOM.formContact.value.trim();
    const isEdit = Boolean(DOM.formOriginalId.value);
    const originalId = DOM.formOriginalId.value;

    let hasError = false;

    // Student ID Validation
    if (!studentId) {
      setFieldError(DOM.formStudentId, DOM.studentIdError, 'Student ID is required.');
      hasError = true;
    } else if (studentId.length < 2) {
      setFieldError(DOM.formStudentId, DOM.studentIdError, 'Student ID must be at least 2 characters.');
      hasError = true;
    }

    // Name Validation
    if (!name) {
      setFieldError(DOM.formName, DOM.nameError, 'Full name is required.');
      hasError = true;
    } else if (name.length < 2) {
      setFieldError(DOM.formName, DOM.nameError, 'Name must be at least 2 characters.');
      hasError = true;
    }

    // Email Validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
      setFieldError(DOM.formEmail, DOM.emailError, 'Email address is required.');
      hasError = true;
    } else if (!emailRegex.test(email)) {
      setFieldError(DOM.formEmail, DOM.emailError, 'Please enter a valid email address.');
      hasError = true;
    }

    // Department Validation
    if (!department) {
      setFieldError(DOM.formDepartment, DOM.departmentError, 'Please select a department.');
      hasError = true;
    }

    // Semester Validation
    const semNum = parseInt(semester, 10);
    if (!semester || isNaN(semNum) || semNum < 1 || semNum > 8) {
      setFieldError(DOM.formSemester, DOM.semesterError, 'Semester must be a number between 1 and 8.');
      hasError = true;
    }

    if (hasError) return;

    // Disable button & show loading state
    const submitBtn = DOM.studentForm.querySelector('button[type="submit"]');
    const originalBtnText = DOM.saveBtnText.textContent;
    submitBtn.disabled = true;
    DOM.saveBtnText.textContent = 'Saving...';

    const payload = {
      studentId,
      name,
      email,
      department,
      semester: semNum,
      contact: contact || '',
    };

    try {
      if (isEdit) {
        await apiUpdateStudent(originalId, payload);
        showToast(`Student record "${studentId}" updated successfully!`, 'success');
      } else {
        await apiCreateStudent(payload);
        showToast(`Student "${name}" (${studentId}) added to MongoDB Atlas!`, 'success');
      }

      closeStudentModal();
      await fetchStudents();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      submitBtn.disabled = false;
      DOM.saveBtnText.textContent = originalBtnText;
    }
  }

  // ==========================================
  // View Details Modal
  // ==========================================

  function openViewModal(studentId) {
    const student = students.find(s => s.studentId === studentId);
    if (!student) return;

    viewingStudent = student;
    const initials = getInitials(student.name);

    DOM.viewModalBody.innerHTML = `
      <div class="view-card">
        <div class="view-top-row">
          <div class="view-avatar">${initials}</div>
          <div class="view-meta">
            <h4>${escapeHTML(student.name)}</h4>
            <span class="student-id-tag" style="margin-top: 4px;">
              <i class="fa-solid fa-id-badge"></i> ${escapeHTML(student.studentId)}
            </span>
          </div>
        </div>

        <div class="view-grid">
          <div class="view-item">
            <span class="view-label">Department</span>
            <span class="view-val">${escapeHTML(student.department)}</span>
          </div>
          <div class="view-item">
            <span class="view-label">Academic Semester</span>
            <span class="view-val">Semester ${escapeHTML(student.semester)} of 8</span>
          </div>
          <div class="view-item" style="grid-column: 1 / -1;">
            <span class="view-label">Email Address</span>
            <span class="view-val">${escapeHTML(student.email)}</span>
          </div>
          <div class="view-item" style="grid-column: 1 / -1;">
            <span class="view-label">Contact Number</span>
            <span class="view-val">${student.contact ? escapeHTML(student.contact) : 'Not Provided'}</span>
          </div>
          <div class="view-item" style="grid-column: 1 / -1;">
            <span class="view-label">Database Record Created</span>
            <span class="view-val">${student.createdAt ? new Date(student.createdAt).toLocaleString() : 'N/A'}</span>
          </div>
        </div>
      </div>
    `;

    DOM.viewModal.classList.add('open');
    DOM.viewModal.setAttribute('aria-hidden', 'false');
  }

  function closeViewModal() {
    viewingStudent = null;
    DOM.viewModal.classList.remove('open');
    DOM.viewModal.setAttribute('aria-hidden', 'true');
  }

  // ==========================================
  // Delete Modal
  // ==========================================

  function openDeleteModal(studentId) {
    const student = students.find(s => s.studentId === studentId);
    if (!student) return;

    studentToDelete = student;
    DOM.deleteStudentDisplayName.textContent = student.name;
    DOM.deleteStudentDisplayId.textContent = student.studentId;

    DOM.deleteModal.classList.add('open');
    DOM.deleteModal.setAttribute('aria-hidden', 'false');
  }

  function closeDeleteModal() {
    studentToDelete = null;
    DOM.deleteModal.classList.remove('open');
    DOM.deleteModal.setAttribute('aria-hidden', 'true');
  }

  async function confirmDeleteStudent() {
    if (!studentToDelete) return;

    const targetId = studentToDelete.studentId;
    const targetName = studentToDelete.name;

    DOM.confirmDeleteBtn.disabled = true;
    DOM.confirmDeleteBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Deleting...';

    try {
      await apiDeleteStudent(targetId);
      showToast(`Student "${targetName}" (${targetId}) deleted from MongoDB Atlas.`, 'error');
      closeDeleteModal();
      await fetchStudents();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      DOM.confirmDeleteBtn.disabled = false;
      DOM.confirmDeleteBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i> <span>Confirm Delete</span>';
    }
  }

  // ==========================================
  // API Settings Modal
  // ==========================================

  function openApiSettingsModal() {
    DOM.apiUrlInput.value = apiBaseUrl;
    DOM.apiUrlInput.placeholder = RENDER_BACKEND_URL;
    DOM.apiTestResult.style.display = 'none';
    DOM.apiSettingsModal.classList.add('open');
    DOM.apiSettingsModal.setAttribute('aria-hidden', 'false');
  }

  function closeApiSettingsModal() {
    DOM.apiSettingsModal.classList.remove('open');
    DOM.apiSettingsModal.setAttribute('aria-hidden', 'true');
  }

  async function testApiConnection() {
    const testUrl = DOM.apiUrlInput.value.trim().replace(/\/+$/, '');
    DOM.apiTestResult.style.display = 'block';
    DOM.apiTestResult.className = 'api-test-result';
    DOM.apiTestResult.textContent = 'Testing connection...';

    if (!testUrl) {
      DOM.apiTestResult.className = 'api-test-result api-test-error';
      DOM.apiTestResult.textContent = 'Please enter an API Base URL to test.';
      return;
    }

    try {
      const res = await fetch(`${testUrl}/health`, { 
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      if (res.ok) {
        const data = await res.json();
        DOM.apiTestResult.className = 'api-test-result api-test-success';
        DOM.apiTestResult.textContent = `Success! Connected to backend API. Database Status: ${data.databaseStatus || 'online'}`;
      } else {
        throw new Error(`HTTP ${res.status} (${res.statusText || 'Server Error'})`);
      }
    } catch (err) {
      DOM.apiTestResult.className = 'api-test-result api-test-error';
      DOM.apiTestResult.textContent = `Connection failed: ${err.message}. Verify that the backend is active and CORS is allowed.`;
    }
  }

  function saveApiSettings() {
    const newUrl = DOM.apiUrlInput.value.trim().replace(/\/+$/, '') || DEFAULT_API_BASE;
    apiBaseUrl = newUrl;
    localStorage.setItem(STORAGE_KEY_API, apiBaseUrl);
    closeApiSettingsModal();
    showToast(`API Base URL set to ${apiBaseUrl}`, 'info');
    checkApiHealth();
    fetchStudents();
  }

  // ==========================================
  // Event Bindings
  // ==========================================

  function bindEvents() {
    // Header & Controls
    DOM.refreshBtn.addEventListener('click', () => {
      checkApiHealth();
      fetchStudents();
      showToast('Refreshing records from database...', 'info');
    });

    DOM.openAddStudentModalBtn.addEventListener('click', openAddModal);
    DOM.emptyAddBtn.addEventListener('click', openAddModal);

    DOM.openApiSettingsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openApiSettingsModal();
    });
    if (DOM.apiStatusPill) {
      DOM.apiStatusPill.addEventListener('click', openApiSettingsModal);
    }

    // Search Input
    DOM.studentSearchInput.addEventListener('input', (e) => {
      currentFilters.search = e.target.value;
      DOM.clearSearchBtn.style.display = e.target.value ? 'flex' : 'none';
      renderTable();
    });

    DOM.clearSearchBtn.addEventListener('click', () => {
      DOM.studentSearchInput.value = '';
      currentFilters.search = '';
      DOM.clearSearchBtn.style.display = 'none';
      DOM.studentSearchInput.focus();
      renderTable();
    });

    // Filters
    DOM.departmentFilterSelect.addEventListener('change', (e) => {
      currentFilters.department = e.target.value;
      renderTable();
    });

    DOM.semesterFilterSelect.addEventListener('change', (e) => {
      currentFilters.semester = e.target.value;
      renderTable();
    });

    DOM.sortBySelect.addEventListener('change', (e) => {
      currentFilters.sortBy = e.target.value;
      renderTable();
    });

    DOM.resetFiltersBtn.addEventListener('click', () => {
      DOM.studentSearchInput.value = '';
      DOM.departmentFilterSelect.value = 'all';
      DOM.semesterFilterSelect.value = 'all';
      currentFilters = { search: '', department: 'all', semester: 'all', sortBy: 'id-asc' };
      DOM.clearSearchBtn.style.display = 'none';
      renderTable();
    });

    // Table Actions Delegation
    DOM.studentsTableBody.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      const id = btn.dataset.id;
      if (!action || !id) return;

      if (action === 'view') openViewModal(id);
      if (action === 'edit') openEditModal(id);
      if (action === 'delete') openDeleteModal(id);
    });

    // Student Form Submit & Close
    DOM.studentForm.addEventListener('submit', handleStudentFormSubmit);
    DOM.closeStudentModalBtn.addEventListener('click', closeStudentModal);
    DOM.cancelFormBtn.addEventListener('click', closeStudentModal);

    // View Modal
    DOM.closeViewModalBtn.addEventListener('click', closeViewModal);
    DOM.closeViewDetailsBtn.addEventListener('click', closeViewModal);
    DOM.editFromViewModalBtn.addEventListener('click', () => {
      if (viewingStudent) {
        const id = viewingStudent.studentId;
        closeViewModal();
        openEditModal(id);
      }
    });

    // Delete Modal
    DOM.confirmDeleteBtn.addEventListener('click', confirmDeleteStudent);
    DOM.cancelDeleteBtn.addEventListener('click', closeDeleteModal);

    // API Settings Modal
    DOM.closeApiSettingsBtn.addEventListener('click', closeApiSettingsModal);
    DOM.cancelApiSettingsBtn.addEventListener('click', closeApiSettingsModal);
    DOM.saveApiSettingsBtn.addEventListener('click', saveApiSettings);
    DOM.setLocalApiPreset.addEventListener('click', () => {
      DOM.apiUrlInput.value = LOCAL_BACKEND_URL;
    });
    if (DOM.setRenderApiPreset) {
      DOM.setRenderApiPreset.addEventListener('click', () => {
        DOM.apiUrlInput.value = RENDER_BACKEND_URL;
      });
    }
    DOM.testApiConnectionBtn.addEventListener('click', testApiConnection);

    // Close Modals on Backdrop Click
    window.addEventListener('click', (e) => {
      if (e.target === DOM.studentModal) closeStudentModal();
      if (e.target === DOM.viewModal) closeViewModal();
      if (e.target === DOM.deleteModal) closeDeleteModal();
      if (e.target === DOM.apiSettingsModal) closeApiSettingsModal();
    });

    // Close Modals on ESC Key
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeStudentModal();
        closeViewModal();
        closeDeleteModal();
        closeApiSettingsModal();
      }
    });
  }

  // ==========================================
  // Initialization
  // ==========================================

  async function init() {
    bindEvents();
    await checkApiHealth();
    await fetchStudents();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
