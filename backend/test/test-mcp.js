/**
 * Automated Verification & Test Suite for Model Context Protocol (MCP) Server
 * Tests:
 * 1. MongoDB Atlas Connection
 * 2. MCP Health check endpoint
 * 3. Streamable HTTP Protocol Handshake (initialize)
 * 4. Tools list discovery (5 tools)
 * 5. list_students tool execution
 * 6. search_students tool execution
 * 7. get_student_by_id tool execution
 * 8. add_student tool RBAC security (unauthorized rejection + authorized creation)
 * 9. update_student tool RBAC security & update
 * 10. Existing REST API regression testing (/health, /api/students)
 */

const path = require('path');
const http = require('http');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = require('../server');
const Student = require('../models/Student');

// Helper for HTTP requests
function httpRequest({ port, path: reqPath, method = 'GET', headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const postData = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;

    const options = {
      hostname: '127.0.0.1',
      port,
      path: reqPath,
      method,
      headers: {
        ...headers,
      },
    };

    if (postData) {
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data,
          json: () => {
            try {
              // Extract SSE json payload if prefixed by "data: "
              if (data.includes('data: {')) {
                const lines = data.split('\n');
                for (const line of lines) {
                  if (line.startsWith('data: ')) {
                    return JSON.parse(line.substring(6).trim());
                  }
                }
              }
              return JSON.parse(data);
            } catch (e) {
              return null;
            }
          },
        });
      });
    });

    req.on('error', (err) => reject(err));

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function runTests() {
  console.log('========================================================');
  console.log('🧪 Starting MCP Server & REST API Automated Test Suite');
  console.log('========================================================\n');

  const TEST_PORT = 54321;
  const serverInstance = await new Promise((resolve) => {
    const s = app.listen(TEST_PORT, '127.0.0.1', () => resolve(s));
  });

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName} ${details ? '(' + details + ')' : ''}`);
      failed++;
    }
  }

  try {
    // -----------------------------------------------------------
    // Test 1: MongoDB Connection Check
    // -----------------------------------------------------------
    console.log('\n--- 1. Testing MongoDB Atlas Connectivity ---');
    const studentCount = await Student.countDocuments();
    assert(typeof studentCount === 'number', 'MongoDB Atlas Connected', `Current records: ${studentCount}`);

    // -----------------------------------------------------------
    // Test 2: Existing REST API Endpoints (Regression Testing)
    // -----------------------------------------------------------
    console.log('\n--- 2. Testing Existing REST API (Zero Regressions) ---');
    const restHealth = await httpRequest({ port: TEST_PORT, path: '/health' });
    assert(restHealth.statusCode === 200, 'REST /health returns 200 OK');
    const restHealthJson = restHealth.json();
    assert(restHealthJson && restHealthJson.status === 'OK', 'REST /health database status is OK');

    const restStudents = await httpRequest({ port: TEST_PORT, path: '/api/students' });
    assert(restStudents.statusCode === 200, 'REST /api/students returns 200 OK');
    const restStudentsJson = restStudents.json();
    assert(restStudentsJson && restStudentsJson.success === true, 'REST /api/students returns valid JSON payload');

    // -----------------------------------------------------------
    // Test 3: MCP Health Endpoint
    // -----------------------------------------------------------
    console.log('\n--- 3. Testing MCP Health Check Endpoint ---');
    const mcpHealth = await httpRequest({ port: TEST_PORT, path: '/mcp/health' });
    assert(mcpHealth.statusCode === 200, 'MCP /mcp/health returns 200 OK');
    const mcpHealthJson = mcpHealth.json();
    assert(
      mcpHealthJson && mcpHealthJson.service === 'Model Context Protocol (MCP) Server',
      'MCP service metadata verified'
    );
    assert(
      Array.isArray(mcpHealthJson.tools) && mcpHealthJson.tools.length === 5,
      'MCP health endpoint reports 5 active tools'
    );

    // -----------------------------------------------------------
    // Test 4: Streamable HTTP Initialization (JSON-RPC handshake)
    // -----------------------------------------------------------
    console.log('\n--- 4. Testing Streamable HTTP Handshake (initialize) ---');
    const initRes = await httpRequest({
      port: TEST_PORT,
      path: '/mcp',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'mcp-test-runner', version: '1.0.0' },
        },
      },
    });

    assert(initRes.statusCode === 200, 'MCP initialize returns 200 OK');
    const sessionId = initRes.headers['mcp-session-id'];
    const initJson = initRes.json();
    assert(
      initJson && initJson.result && initJson.result.serverInfo && initJson.result.serverInfo.name.includes('student'),
      'MCP Handshake returned serverInfo and protocol negotiation'
    );

    const mcpHeaders = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    };
    if (sessionId) {
      mcpHeaders['mcp-session-id'] = sessionId;
    }

    // -----------------------------------------------------------
    // Test 5: Tools Discovery (tools/list)
    // -----------------------------------------------------------
    console.log('\n--- 5. Testing Tools Discovery (tools/list) ---');
    const toolsRes = await httpRequest({
      port: TEST_PORT,
      path: '/mcp',
      method: 'POST',
      headers: mcpHeaders,
      body: {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {},
      },
    });

    assert(toolsRes.statusCode === 200, 'MCP tools/list returns 200 OK');
    const toolsJson = toolsRes.json();
    const registeredTools = (toolsJson && toolsJson.result && toolsJson.result.tools) || [];
    const toolNames = registeredTools.map((t) => t.name);
    console.log(`   Found ${registeredTools.length} tools: ${toolNames.join(', ')}`);

    assert(toolNames.includes('list_students'), 'Tool list_students registered');
    assert(toolNames.includes('get_student_by_id'), 'Tool get_student_by_id registered');
    assert(toolNames.includes('search_students'), 'Tool search_students registered');
    assert(toolNames.includes('add_student'), 'Tool add_student registered');
    assert(toolNames.includes('update_student'), 'Tool update_student registered');

    // -----------------------------------------------------------
    // Test 6: Tool Execution - list_students
    // -----------------------------------------------------------
    console.log('\n--- 6. Testing Tool: list_students ---');
    const listCall = await httpRequest({
      port: TEST_PORT,
      path: '/mcp',
      method: 'POST',
      headers: mcpHeaders,
      body: {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'list_students',
          arguments: { limit: 5 },
        },
      },
    });

    assert(listCall.statusCode === 200, 'tools/call list_students returns 200');
    const listJson = listCall.json();
    const listContentText = listJson?.result?.content?.[0]?.text || '';
    const parsedList = JSON.parse(listContentText || '{}');
    assert(parsedList.success === true, 'list_students returns success: true');
    assert(Array.isArray(parsedList.data), 'list_students returns student array');

    // -----------------------------------------------------------
    // Test 7: Tool Execution - search_students
    // -----------------------------------------------------------
    console.log('\n--- 7. Testing Tool: search_students ---');
    const searchCall = await httpRequest({
      port: TEST_PORT,
      path: '/mcp',
      method: 'POST',
      headers: mcpHeaders,
      body: {
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'search_students',
          arguments: { query: 'Computer' },
        },
      },
    });

    assert(searchCall.statusCode === 200, 'tools/call search_students returns 200');
    const searchJson = searchCall.json();
    const searchContentText = searchJson?.result?.content?.[0]?.text || '';
    const parsedSearch = JSON.parse(searchContentText || '{}');
    assert(parsedSearch.success === true, 'search_students returns success: true');

    // -----------------------------------------------------------
    // Test 8: Tool Execution - get_student_by_id
    // -----------------------------------------------------------
    console.log('\n--- 8. Testing Tool: get_student_by_id ---');
    let targetStudentId = 'STU-1001';
    if (parsedList.data && parsedList.data.length > 0) {
      targetStudentId = parsedList.data[0].studentId;
    }

    const getByIdCall = await httpRequest({
      port: TEST_PORT,
      path: '/mcp',
      method: 'POST',
      headers: mcpHeaders,
      body: {
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: {
          name: 'get_student_by_id',
          arguments: { identifier: targetStudentId },
        },
      },
    });

    assert(getByIdCall.statusCode === 200, 'tools/call get_student_by_id returns 200');
    const getByIdJson = getByIdCall.json();
    const getByIdText = getByIdJson?.result?.content?.[0]?.text || '';
    const parsedGetById = JSON.parse(getByIdText || '{}');
    assert(parsedGetById.success === true, `get_student_by_id found student "${targetStudentId}"`);

    // -----------------------------------------------------------
    // Test 9: Tool Execution - add_student (RBAC Authorization)
    // -----------------------------------------------------------
    console.log('\n--- 9. Testing Tool: add_student (RBAC Security) ---');
    const testNewId = `STU-MCP-${Date.now().toString().slice(-4)}`;
    const testNewEmail = `mcp.test.${Date.now().toString().slice(-4)}@example.com`;

    // 9a. Should fail without token
    const unauthorizedAdd = await httpRequest({
      port: TEST_PORT,
      path: '/mcp',
      method: 'POST',
      headers: mcpHeaders,
      body: {
        jsonrpc: '2.0',
        id: 6,
        method: 'tools/call',
        params: {
          name: 'add_student',
          arguments: {
            studentId: testNewId,
            name: 'Unauthorized Tester',
            email: testNewEmail,
            department: 'Computer Science',
            semester: 4,
          },
        },
      },
    });

    const unauthJson = unauthorizedAdd.json();
    const unauthText = unauthJson?.result?.content?.[0]?.text || '';
    assert(
      unauthJson?.result?.isError === true || unauthText.includes('Authorization Failed'),
      'add_student safely rejects unauthenticated request'
    );

    // 9b. Generate test auth token
    const tokenRes = await httpRequest({
      port: TEST_PORT,
      path: '/mcp/auth/generate-token',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { role: 'admin', email: 'dean@college.edu' },
    });
    const tokenJson = tokenRes.json();
    const adminToken = tokenJson.token;
    assert(Boolean(adminToken), 'Generated admin JWT token for MCP authorization');

    // 9c. Now call add_student with token
    const authorizedAdd = await httpRequest({
      port: TEST_PORT,
      path: '/mcp',
      method: 'POST',
      headers: {
        ...mcpHeaders,
        Authorization: `Bearer ${adminToken}`,
      },
      body: {
        jsonrpc: '2.0',
        id: 7,
        method: 'tools/call',
        params: {
          name: 'add_student',
          arguments: {
            studentId: testNewId,
            name: 'MCP Automation Student',
            email: testNewEmail,
            department: 'Artificial Intelligence',
            semester: 5,
            contact: '555-987-6543',
            authToken: adminToken,
          },
        },
      },
    });

    assert(authorizedAdd.statusCode === 200, 'add_student with admin token returns 200');
    const authAddJson = authorizedAdd.json();
    const authAddText = authAddJson?.result?.content?.[0]?.text || '';
    const parsedAdd = JSON.parse(authAddText || '{}');
    assert(parsedAdd.success === true, `add_student successfully registered "${testNewId}"`);

    // -----------------------------------------------------------
    // Test 10: Tool Execution - update_student (RBAC Security)
    // -----------------------------------------------------------
    console.log('\n--- 10. Testing Tool: update_student (RBAC Security) ---');
    const updateCall = await httpRequest({
      port: TEST_PORT,
      path: '/mcp',
      method: 'POST',
      headers: {
        ...mcpHeaders,
        Authorization: `Bearer ${adminToken}`,
      },
      body: {
        jsonrpc: '2.0',
        id: 8,
        method: 'tools/call',
        params: {
          name: 'update_student',
          arguments: {
            identifier: testNewId,
            semester: 6,
            name: 'MCP Automation Student (Updated)',
            authToken: adminToken,
          },
        },
      },
    });

    assert(updateCall.statusCode === 200, 'update_student returns 200');
    const updateJson = updateCall.json();
    const updateText = updateJson?.result?.content?.[0]?.text || '';
    const parsedUpdate = JSON.parse(updateText || '{}');
    assert(
      parsedUpdate.success === true && parsedUpdate.data?.semester === 6,
      `update_student successfully incremented semester to 6 for "${testNewId}"`
    );

    // Clean up test student
    await Student.deleteOne({ studentId: testNewId });
    console.log(`   Cleaned up temporary test record: ${testNewId}`);
  } catch (err) {
    console.error('Unhandled test failure:', err);
    failed++;
  } finally {
    serverInstance.close();
  }

  console.log('\n========================================================');
  console.log(`🏁 Test Summary: ${passed} Passed, ${failed} Failed`);
  console.log('========================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
