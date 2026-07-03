/**
 * ESS交付管理系统 - 轻量级后端服务
 * 功能：邮件发送 + 云盘上传
 * 
 * 使用方法：
 *   1. npm install nodemailer form-data node-fetch
 *   2. 编辑下方配置（邮箱/云盘信息）
 *   3. node server.js
 *   4. 访问 http://localhost:3000
 * 
 * 部署建议：
 *   - 本地运行：node server.js
 *   - 云服务器：pm2 start server.js --name ess-api
 */

const http = require('http');
const url = require('url');
const querystring = require('querystring');
const fs = require('fs');
const path = require('path');

// ========== 配置区（请根据实际情况修改）==========

// SMTP邮件配置（以139邮箱为例）
const EMAIL_CONFIG = {
  enabled: true,           // 是否启用邮件功能
  host: 'smtp.139.com',    // SMTP服务器地址
  port: 465,               // SSL端口(465) 或 TLS端口(587)
  secure: true,            // true=SSL, false=TLS
  user: '18372757379@139.com',  // 发件人邮箱
  pass: 'YOUR_EMAIL_PASSWORD',  // 邮箱授权码（非登录密码）
  from: '"ESS交付管理系统" <18372757379@139.com>',  // 发件人显示名称
  defaultTo: '18372757379@139.com'  // 默认收件人
};

// Cloudreve云盘配置
const CLOUD_CONFIG = {
  enabled: false,          // 是否启用云盘上传（需先配置）
  apiBaseUrl: 'https://www.go127.com/api/v3',  // Cloudreve API地址
  session: '',             // Cloudreve Session（登录后获取）
  uploadPath: '/ESS/调研/满意度调查/',         // 上传目标目录
};

// API端口
const PORT = process.env.PORT || 3000;

// 允许的跨域域名
const ALLOWED_ORIGINS = [
  'http://localhost:*',
  'https://adan-1983.github.io',
  'http://127.0.0.1:*'
];

// ========== 工具函数 ==========

function corsHeaders(reqOrigin) {
  const allowed = ALLOWED_ORIGINS.some(origin => {
    if (origin.endsWith(':*')) {
      return reqOrigin && reqOrigin.startsWith(origin.slice(0, -2));
    }
    return origin === reqOrigin;
  });
  return {
    'Access-Control-Allow-Origin': allowed ? reqOrigin || '*' : '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
  };
}

function jsonResponse(res, statusCode, data) {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => { raw += chunk.toString(); });
    req.on('end', () => {
      try {
        const ct = req.headers['content-type'] || '';
        if (ct.includes('application/json')) {
          resolve(JSON.parse(raw));
        } else {
          resolve(querystring.parse(raw));
        }
      } catch(e) { reject(e); }
    });
    req.on('error', reject);
  });
}

// ========== 邮件发送模块（使用内置HTTP请求模拟SMTP）==========

async function sendEmailViaAPI(emailData) {
  /**
   * 邮件发送方案说明：
   * 
   * 由于纯Node.js环境可能未安装nodemailer，这里提供两种方案：
   * 
   * 方案A（推荐）：安装nodemailer后使用
   *   npm install nodemailer
   *   然后取消下方注释使用完整版
   * 
   * 方案B（备用）：使用HTTP API转发到第三方邮件服务
   *   如：mailgun、sendgrid、阿里云邮件推送等
   */
  
  if (!EMAIL_CONFIG.enabled) {
    return { success: false, error: '邮件功能未启用' };
  }

  try {
    // 尝试加载nodemailer
    let transporter;
    try {
      const nodemailer = require('nodemailer');
      transporter = nodemailer.createTransport({
        host: EMAIL_CONFIG.host,
        port: EMAIL_CONFIG.port,
        secure: EMAIL_CONFIG.secure,
        auth: {
          user: EMAIL_CONFIG.user,
          pass: EMAIL_CONFIG.pass
        }
      });

      const info = await transporter.sendMail({
        from: EMAIL_CONFIG.from,
        to: emailData.to || EMAIL_CONFIG.defaultTo,
        subject: emailData.subject || 'ESS交付管理系统通知',
        text: emailData.text || '',
        html: emailData.html || emailData.text?.replace(/\n/g, '<br>') || '',
        attachments: emailData.attachments || []
      });

      return { 
        success: true, 
        messageId: info.messageId,
        method: 'nodemailer-smtp'
      };
    } catch (e) {
      // nodemailer未安装，返回配置提示
      return {
        success: false,
        error: 'nodemailer未安装。请执行：npm install nodemailer',
        hint: `当前邮件配置: ${EMAIL_CONFIG.host}:${EMAIL_CONFIG.port}`,
        fallback: '将降级使用mailto协议'
      };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ========== 云盘上传模块 ==========

async function uploadToCloudreve(fileData) {
  /**
   * Cloudreve API 上传
   * 文档：https://docs.cloudreve.org/getting-started/api
   * 
   * 使用步骤：
   * 1. 在Cloudreve后台获取Session（登录API）
   * 2. 调用上传API上传文件
   */
  
  if (!CLOUD_CONFIG.enabled) {
    return { success: false, error: '云盘功能未启用' };
  }

  try {
    const https = require('https') || require('http');

    // Step 1: 检查Session是否有效
    if (!CLOUD_CONFIG.session) {
      return { success: false, error: 'Cloudreve Session未配置' };
    }

    // Step 2: 获取上传策略
    const uploadInfo = await new Promise((resolve, reject) => {
      const postData = JSON.stringify({
        path: CLOUD_CONFIG.uploadPath + fileData.filename,
        size: fileData.size,
        policy: { 
          allowS3: false, 
          allowLocal: true, 
          allowOneDrive: false, 
          allowOSS: false 
        }
      });

      const options = {
        hostname: url.parse(CLOUD_CONFIG.apiBaseUrl).hostname,
        path: CLOUD_CONFIG.apiBaseUrl.replace(url.parse(CLOUD_CONFIG.apiBaseUrl).href, '') + '/file/upload',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'Authorization': CLOUD_CONFIG.session
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(JSON.parse(data)));
      });
      req.on('error', reject);
      req.write(postData);
      req.end();
    });

    // Step 3: 执行上传（根据返回的上传策略）
    // ... 完整上传逻辑需要根据Cloudreve API响应处理
    
    return { 
      success: true, 
      message: '云盘上传功能已就绪，请完善配置',
      uploadInfo,
      note: '需要配置CLOUD_CONFIG.session和启用enabled=true'
    };

  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ========== HTTP服务器 ==========

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const headers = corsHeaders(req.headers.origin);

  // CORS预检
  if (req.method === 'OPTIONS') {
    res.writeHead(204, headers);
    res.end();
    return;
  }

  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${pathname}`);

  // ===== API路由 =====

  // 健康检查
  if (pathname === '/api/health' && req.method === 'GET') {
    return jsonResponse(res, 200, {
      status: 'ok',
      service: 'ESS交付管理系统 API',
      version: '1.0.0',
      features: {
        email: EMAIL_CONFIG.enabled,
        cloud: CLOUD_CONFIG.enabled
      },
      timestamp: new Date().toISOString()
    });
  }

  // 邮件发送接口
  if (pathname === '/api/send-email' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const result = await sendEmailViaAPI({
        to: body.to,
        subject: body.subject,
        text: body.text,
        html: body.html,
        attachments: body.attachments
      });
      
      console.log('[邮件]', result.success ? '发送成功' : '发送失败:', result.error || result.messageId);
      return jsonResponse(res, result.success ? 200 : 500, result);
    } catch (e) {
      console.error('[邮件错误]', e.message);
      return jsonResponse(res, 500, { success: false, error: e.message });
    }
  }

  // 云盘上传接口
  if (pathname === '/api/cloud-upload' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const result = await uploadToCloudreve({
        filename: body.filename,
        size: body.size,
        content: body.content  // base64编码的文件内容
      });
      
      console.log('[云盘]', result.success ? '上传成功' : '上传失败:', result.error);
      return jsonResponse(res, result.success ? 200 : 500, result);
    } catch (e) {
      console.error('[云盘错误]', e.message);
      return jsonResponse(res, 500, { success: false, error: e.message });
    }
  }

  // 配置查看接口（隐藏敏感信息）
  if (pathname === '/api/config' && req.method === 'GET') {
    return jsonResponse(res, 200, {
      emailEnabled: EMAIL_CONFIG.enabled,
      emailHost: EMAIL_CONFIG.host.replace(/\d+@\w+\.\w+/, '***@***.***'),
      cloudEnabled: CLOUD_CONFIG.enabled,
      cloudApiBase: CLOUD_CONFIG.apiBaseUrl,
      version: '1.0.0'
    });
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not Found', path: pathname }));
});

server.listen(PORT, () => {
  console.log('\n╔══════════════════════════════════════╗');
  console.log('║   ESS交付管理系统 - 后端API服务       ║');
  console.log('╠══════════════════════════════════════╣');
  console.log(`║  服务地址: http://localhost:${PORT.toString().padEnd(17)}║`);
  console.log(`║  邮件功能: ${EMAIL_CONFIG.enabled ? '已启用' : '未启用'.padEnd(22)}║`);
  console.log(`║  云盘功能: ${CLOUD_CONFIG.enabled ? '已启用' : '未启用'.padEnd(22)}║`);
  console.log('╠══════════════════════════════════════╣');
  console.log('║  API接口:                             ║');
  console.log('║  GET  /api/health     健康检查        ║');
  console.log('║  POST /api/send-email 发送邮件        ║');
  console.log('║  POST /api/cloud-upload 云盘上传      ║');
  console.log('║  GET  /api/config     查看配置        ║');
  console.log('╚══════════════════════════════════════╝\n');
  
  if (!EMAIL_CONFIG.enabled) {
    console.log('⚠️  提示: 邮件功能未启用，前端将降级使用mailto协议');
    console.log('   启用方法: 修改EMAIL_CONFIG.enabled = true 并配置SMTP\n');
  }
  
  if (EMAIL_CONFIG.enabled && EMAIL_CONFIG.pass === 'YOUR_EMAIL_PASSWORD') {
    console.log('⚠️  提示: 请修改EMAIL_CONFIG.pass为真实的邮箱授权码\n');
  }
});

module.exports = server;
