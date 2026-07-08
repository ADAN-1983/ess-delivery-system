// ============================================================
// app.js - ESS交付管理系统 v1.1 主控脚本
// 修复：L1默认选中+参数 | L2进度轴 | Tab均分 | 次级标签内容
// 丰富：生产制造/物流/安装/调试/移交/售后 全部子页面内容
// ============================================================

const App = (function() {
  'use strict';

  const PHASE_DEFS = [
    { key: '1_rnd',        name: '新品研发',     icon: '🔬', shortName: '1.新品研发' },
    { key: '2_bd',         name: '商务拓展',     icon: '🤝', shortName: '2.商务拓展' },
    { key: '3_mfg',        name: '生产制造',     icon: '🏭', shortName: '3.生产制造' },
    { key: '4_logistics',  name: '物流运输',     icon: '🚛', shortName: '4.物流运输' },
    { key: '5_install',    name: '现场安装',     icon: '🏗️', shortName: '5.现场安装' },
    { key: '6_commission', name: '系统调试',     icon: '🔧', shortName: '6.系统调试' },
    { key: '7_handover',   name: '移交接产',     icon: '📋', shortName: '7.移交接产' },
    { key: '8_aftersales', name: '售后服务',     icon: '🛡️', shortName: '8.售后服务' },
    { key: '9_ops',        name: '运维管理',     icon: '📊', shortName: '9.运维管理' }
  ];

  let currentTab = '5_install';

  // ========== 初始化 ==========
  async function init() {
    console.log('App.init() 开始...');
    await Store.init();
    console.log('Store.init() 完成, 项目数:', Store.getAllProjects().length);
    renderProjectSelector();
    renderProgressAxis();
    renderTabNav();
    switchTab(currentTab);
    renderFoldableCards();
    Store.on('projectChanged', onProjectChanged);
    Store.on('progressChanged', onProgressChanged);
    Store.on('dataChanged', onDataChanged);
    toast('系统就绪，默认项目：印度ReNew 120MW/240MWh调峰电站', 'info');
  }

  // ==================== L1 项目选择器 ====================
  function renderProjectSelector() {
    const sel = document.getElementById('projectSelect');
    const projects = Store.getAllProjects();
    if (!sel || !projects || projects.length === 0) return;
    sel.innerHTML = projects.map(p =>
      `<option value="${p.id}" ${p.id === Store.getSelectedProjectId() ? 'selected' : ''}>${p.name}</option>`
    ).join('');
    updateProjectParams();
  }

  function selectProject(id) {
    Store.setSelectedProject(id);
    updateProjectParams();
    renderProgressAxis();
    switchTab(currentTab);
    renderFoldableCards();
  }

  function updateProjectParams() {
    const p = Store.getSelectedProject();
    if (!p) return;
    const container = document.getElementById('projParams');
    if (!container) return;
    const statusClass = p.status === '已交付' ? 'delivered' : (p.status === '交付中' ? 'in-progress' : 'planned');
    container.innerHTML = `
      <div class="proj-param"><span class="label">容量</span><span class="value">${p.capacity}</span></div>
      <div class="proj-param"><span class="label">柜数</span><span class="value">${p.cabinetCount}柜</span></div>
      <div class="proj-param"><span class="label">电池</span><span class="value">${p.batteryTech}</span></div>
      <div class="proj-param"><span class="label">地点</span><span class="value">${p.location}</span></div>
      <div class="proj-param"><span class="label">合同</span><span class="value">${p.contractType}</span></div>
      <span class="proj-status ${statusClass}">${p.status}</span>` + renderDeliveryOverview();
  }

  // ========== L1 交付状态概览柱状图 ==========
  function renderDeliveryOverview() {
    var projects = Store.getAllProjects();
    var total = projects.length;
    if (total === 0) return '';
    var delivered = 0, inProgress = 0, planned = 0;
    for (var i = 0; i < total; i++) {
      var s = projects[i].status;
      if (s === '已交付') delivered++;
      else if (s === '交付中') inProgress++;
      else planned++;
    }
    var maxCount = Math.max(delivered, inProgress, planned, 1);
    // 柱高按比例：最高=22px，最低=4px
    var hDel = Math.max(4, Math.round(delivered / maxCount * 22));
    var hInP = Math.max(4, Math.round(inProgress / maxCount * 22));
    var hPla = Math.max(4, Math.round(planned / maxCount * 22));
    var pDel = total > 0 ? Math.round(delivered / total * 100) : 0;
    var pInP = total > 0 ? Math.round(inProgress / total * 100) : 0;
    var pPla = total > 0 ? Math.round(planned / total * 100) : 0;

    return '<div class="delivery-overview" title="项目交付总览: 已交付'+delivered+'个('+pDel+'%) | 交付中'+inProgress+'个('+pInP+'%) | 待交付'+planned+'个('+pPla+'%)">' +
      '<span class="delivery-overview-title">交付概览</span>' +
      '<div class="delivery-bars">' +
        '<div class="delivery-bar-item">' +
          '<div class="delivery-bar bar-delivered" style="height:'+hDel+'px"></div>' +
          '<span class="delivery-bar-count count-delivered">'+delivered+'</span>' +
          '<span class="delivery-bar-label">已交付</span>' +
        '</div>' +
        '<div class="delivery-bar-item">' +
          '<div class="delivery-bar bar-inprogress" style="height:'+hInP+'px"></div>' +
          '<span class="delivery-bar-count count-inprogress">'+inProgress+'</span>' +
          '<span class="delivery-bar-label">交付中</span>' +
        '</div>' +
        '<div class="delivery-bar-item">' +
          '<div class="delivery-bar bar-planned" style="height:'+hPla+'px"></div>' +
          '<span class="delivery-bar-count count-planned">'+planned+'</span>' +
          '<span class="delivery-bar-label">待交付</span>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  // ==================== L2 进度轴 ====================
  function renderProgressAxis() {
    const p = Store.getSelectedProject();
    if (!p) return;
    const phases = p.phases;
    const container = document.getElementById('progressAxis');
    if (!container) return;

    // ★ 根据项目状态计算显示进度（而非直接读phases，避免localStorage数据错误）
    const displayPhases = {};
    const phaseKeys = Object.keys(phases);
    if (p.status === '已交付') {
      phaseKeys.forEach(function(k) { displayPhases[k] = 100; });
    } else if (p.status === '计划交付') {
      // 计划交付：1~3阶段显示实际值（通常很低），4~9强制0
      phaseKeys.forEach(function(k) { displayPhases[k] = (k.indexOf('4_') === 0 || k.indexOf('5_') === 0 || k.indexOf('6_') === 0 || k.indexOf('7_') === 0 || k.indexOf('8_') === 0 || k.indexOf('9_') === 0) ? 0 : (phases[k] ? phases[k].completed : 0); });
    } else {
      // 交付中：显示实际值
      phaseKeys.forEach(function(k) { displayPhases[k] = phases[k] ? phases[k].completed : 0; });
    }

    const totalPhases = PHASE_DEFS.filter(d => d.key !== '9_ops');
    const avgComplete = totalPhases.reduce((s, d) => s + (displayPhases[d.key] || 0), 0) / totalPhases.length;
    let activeFound = false;

    let html = `<div class="progress-line"><div class="progress-line-fill" style="width: ${avgComplete}%"></div></div>`;

    PHASE_DEFS.forEach((def, idx) => {
      const comp = displayPhases[def.key] || 0;
      let cssClass = 'white';
      if (comp === 100) cssClass = 'gray';
      else if (comp > 0) { cssClass = 'green'; activeFound = true; }
      else if (!activeFound && idx < PHASE_DEFS.length - 1) {
        const prevIdx = idx - 1;
        if (prevIdx >= 0 && (displayPhases[PHASE_DEFS[prevIdx].key] || 0) === 100) {
          if (!activeFound) cssClass = 'orange';
        }
      }
      if (def.key === '9_ops') cssClass = 'dashed';
      const isActive = currentTab === def.key;
      const flagHTML = (def.key === '8_aftersales') ? '<span class="flag-icon">🏁</span>' : '';

      html += `<div class="progress-node ${cssClass}${isActive ? ' active' : ''}" onclick="App.switchTab('${def.key}')" title="${def.name}: ${comp}%">
        <div class="dot">${comp === 100 ? '✓' : (comp > 0 ? comp + '%' : (idx + 1))}${flagHTML}</div>
        <div class="label">${def.shortName}</div>
      </div>`;
    });
    container.innerHTML = html;
  }

  // ==================== L3 Tab导航 ====================
  function renderTabNav() {
    const nav = document.getElementById('tabNav');
    if (!nav) return;
    nav.innerHTML = PHASE_DEFS.map((def) => {
      const extraClass = def.key === '9_ops' ? ' dashed-style' : '';
      const isActive = currentTab === def.key;
      return `<button class="tab-btn${extraClass}${isActive ? ' active' : ''}" data-tab-key="${def.key}" onclick="App.switchTab('${def.key}')">${def.icon} ${def.shortName}</button>`;
    }).join('');
  }

  function switchTab(tabKey) {
    currentTab = tabKey;
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tabKey === tabKey);
    });
    renderProgressAxis();

    const content = document.getElementById('tabContent');
    if (!content) return;

    const renderers = {
      '1_rnd': renderRndTab, '2_bd': renderBDTab, '3_mfg': renderMfgTab,
      '4_logistics': renderLogisticsTab, '5_install': renderInstallTab,
      '6_commission': renderCommissionTab, '7_handover': renderHandoverTab,
      '8_aftersales': renderAftersalesTab, '9_ops': renderOpsTab
    };
    content.innerHTML = (renderers[tabKey] || (() => '<div style="padding:40px;text-align:center;color:var(--c-gray-500);">开发中...</div>'))();
    setTimeout(function() {
      bindSubTabEvents();
      // 初始化各Tab的特定状态
      if (tabKey === '1_rnd') initRDAllCompletedState();
      if (tabKey === '3_mfg') { initMfgAllCompletedState(); drawMfgChart(); refreshMfgRiskCard('mfg-fat'); }
      if (tabKey === '5_install') {
        initInstallAllCompletedState();
        drawInstallChart();
        // 初始化效率卡片（默认显示第一个子标签ins-1的数据）
        refreshInstallEfficiencyCard('ins-1');
      }
      if (tabKey === '6_commission') {
        initSATAllPassedState();
        drawSATChart();
        // 初始化风险卡片与效率卡片（默认显示第一个子标签sat-1的数据）
        refreshCommissionRiskCard('sat-1');
        refreshCommissionEfficiencyCard('sat-1');
      }
      if (tabKey === '4_logistics') {
        drawLogisticsChart();
        refreshLogisticsRiskCard('log-overview');
      }
      if (tabKey === '8_aftersales') {
        loadQuickStats();
      }
    }, 50);
  }

  // ========== Tab 1: 新品研发（重构：横向标签页 + 详细检查项表格）==========
  function renderRndTab() {
    var rdSOP = Store.getRdSOP();
    var phases = rdSOP.phases || [];

    // ① 水平标签栏
    var tabNavHTML = '<div class="rd-sub-tabs" id="rdSubTabs">' 
      + phases.map(function(p, idx) {
          return '<button class="rd-phase-btn' + (idx===0?' active':'') + '" data-rd-phase="' + p.id + '" onclick="App.switchRdPhase(this)">' + p.name + '</button>';
        }).join('')
      + '<label class="rd-all-completed-wrap" style="margin-left:auto;" title="勾选代表所有研发任务全部完成"><input type="checkbox" id="rdAllCompleted" onchange="App.toggleRDAllCompleted(this)"> 研发全部完成</label>'
      + '</div>';

    // ② 首个phase的表格区域
    var firstPhase = phases[0];
    var tableAreaHTML = '<div id="rdTableArea">' + buildRdPhaseTable(firstPhase) + '</div>';

    // ③ 右侧协同与风险卡片
    var collabHTML = '<div class="card" style="position:sticky;top:12px;"><div class="card-header">研发与交付协同</div><div class="card-body" id="rdCollabContent">' + buildRdCollabItems(firstPhase) + '</div></div>';
    var riskHTML = '<div class="card card-foldable open" style="position:sticky;top:12px;"><div class="card-header" onclick="App.toggleCardFold(this)">⚠ 风险提示与对策</div><div class="card-foldable-content" id="rdRiskCardContent">' + buildRdRiskItems(firstPhase) + '</div></div>';

    // ④ 左右分栏布局
    return '<div style="display:flex;gap:12px;align-items:flex-start;">'
      + '<div style="flex:1;min-width:0;">'
        + tabNavHTML
        + tableAreaHTML
      + '</div>'
      + '<div style="width:280px;flex-shrink:0;">'
        + collabHTML
        + riskHTML
      + '</div>'
      + '</div>';
  }

  // 构建单个R&D phase的详细表格
  function buildRdPhaseTable(phase) {
    if (!phase || !phase.checks || phase.checks.length === 0) {
      return '<div class="card"><div class="card-body text-muted">暂无检查项数据</div></div>';
    }
    var allChecks = getMergedChecks('rd', phase);
    return `
      <div class="card">
        <div class="card-header" style="display:flex;align-items:center;justify-content:space-between;">
          <span>${phase.name} <span class="text-xs text-muted">(共${allChecks.length}项 | ${phase.standardHours||'—'} | ${phase.canParallel?'可并行':'不可并行'})</span></span>
          <div style="display:flex;align-items:center;gap:8px;">
            ${phase.witness ? '<span class="text-xs" style="color:var(--c-primary);">👤 '+phase.witness+'</span>' : ''}
            <button class="btn btn-sm" onclick="App.addCustomCheck('rd','${phase.id}')" style="font-size:12px;padding:4px 10px;">+ 添加检查项</button>
          </div>
        </div>
        <div class="card-body" style="padding:0;overflow-x:auto;">
          <table class="delivery-table">
            <thead><tr>
              <th style="width:36px;text-align:center;"><input type="checkbox" onchange="App.toggleRDSelectAll(this,'${phase.id}')" title="全选/全不选" style="width:16px;height:16px;cursor:pointer;accent-color:var(--c-primary);"></th>
              <th style="min-width:130px;">检查项目</th>
              <th style="min-width:200px;">具体内容/要求</th>
              <th style="min-width:120px;">验收标准</th>
              <th style="min-width:130px;">参考标准编号</th>
              <th style="min-width:110px;">检查工具</th>
              <th style="width:60px;">类型</th>
              <th style="width:65px;">验收结果</th>
              <th style="width:75px;">备注</th>
            </tr></thead>
            <tbody>
              ${allChecks.map(function(ch) {
                var isCustom = ch.id.indexOf('-custom-') >= 0;
                return `<tr id="row-${ch.id}">
                  <td style="text-align:center;"><input type="checkbox" id="${ch.id}" onchange="App.onRDCheck(this);App.updateRndOverallProgress()"></td>
                  <td>${ch.item}</td>
                  <td style="font-size:11px;color:var(--c-gray-600);">${ch.content||'—'}</td>
                  <td style="font-size:11px;">${ch.standard||'-'}</td>
                  <td style="font-size:11px;color:var(--c-primary);">${ch.refStd||'-'}</td>
                  <td style="font-size:11px;color:var(--c-gray-500);">${ch.tool||'-'}</td>
                  <td><span class="badge badge-${ch.type==='关键'?'danger':ch.type==='重要'?'warning':'info'}" style="font-size:10px;padding:1px 6px;border-radius:3px;">${ch.type||'一般'}</span></td>
                  <td><select class="result-select" id="result-${ch.id}" style="font-size:11px;padding:2px 4px;border-radius:3px;border:1px solid var(--c-gray-200);"><option>待定</option><option>合格</option><option>不合格</option></select></td>
                  <td><input class="inline-input" style="width:55px;" id="note-${ch.id}" placeholder="备注" onchange="">${isCustom ? ' <button class="btn btn-sm btn-outline" onclick="App.removeCustomCheck(\'rd\',\'' + phase.id + '\',\'' + ch.id + '\')" title="删除此项" style="padding:0 3px;font-size:10px;line-height:1;">✕</button>' : ''}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
          <div style="padding:8px 12px;font-size:12px;color:var(--c-gray-600);border-top:1px solid var(--c-gray-100);">
            本阶段完成: <strong id="phase-pct-${phase.id}">0%</strong>
            <span style="float:right;color:var(--c-gray-400);">记录输出: ${allChecks[0]?allChecks[0].record||'-':'-'}</span>
          </div>
        </div>
      </div>`;
  }

  // 构建研发协同事项
  function buildRdCollabItems(phase) {
    var collab = phase.collab || [];
    if (collab.length === 0) return '<div style="padding:12px;color:var(--c-gray-400);font-size:12px;">暂无协同事项</div>';
    var statusOpts = '<option value="">— 选择 —</option><option value="pending">⏳ 待开始</option><option value="progress">◉ 进行中</option><option value="done">✓ 已完成</option>';
    return '<table class="delivery-table" style="font-size:12px;">'
      + '<thead><tr><th>协同事项</th><th>负责人</th><th>状态</th></tr></thead>'
      + '<tbody>'
      + collab.map(function(item) {
          var sVal = item.status || 'pending';
          var sColor = sVal==='done'?'#16a34a':sVal==='progress'?'#2563eb':'#d97706';
          return `<tr>
            <td>${item.item}</td>
            <td><input type="text" value="${item.owner||''}" placeholder="输入姓名" style="width:100%;padding:3px 6px;border:1px solid #d1d5db;border-radius:4px;font-size:11px;box-sizing:border-box;" /></td>
            <td><select onchange="this.style.color=this.options[this.selectedIndex].style.color||'#d97706'" style="width:100%;padding:4px 6px;border:1px solid #d1d5db;border-radius:4px;font-size:11px;cursor:pointer;color:${sColor};box-sizing:border-box;">${statusOpts}<option value="${sVal}" selected style="color:${sColor}">${sVal==='pending'?'⏳ 待开始':sVal==='progress'?'◉ 进行中':'✓ 已完成'}</option></select></td>
          </tr>`;
        }).join('')
      + '</tbody></table>';
  }

  // 构建研发风险项
  function buildRdRiskItems(phase) {
    var risks = phase.risks || [];
    if (risks.length === 0) return '<div style="padding:12px;color:var(--c-gray-400);font-size:12px;">暂无风险项</div>';
    return risks.map(function(r) {
        return '<div class="risk-item risk-' + r.level + '"><span class="risk-icon">' + (r.level==='high'?'🔴':r.level==='medium'?'🟡':'🔵') + '</span><span>' + r.text + '</span></div>';
      }).join('');
  }

  // 切换研发阶段
  function switchRdPhase(btn) {
    var phaseId = btn.getAttribute('data-rd-phase');
    var rdSOP = Store.getRdSOP();
    var phase = (rdSOP.phases||[]).find(function(p) { return p.id === phaseId; });
    if (!phase) return;

    // 更新标签样式
    var tabContainer = document.getElementById('rdSubTabs');
    if (tabContainer) {
      var buttons = tabContainer.querySelectorAll('.rd-phase-btn');
      buttons.forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
    }

    // 更新表格区域
    var tableArea = document.getElementById('rdTableArea');
    if (tableArea) {
      tableArea.innerHTML = buildRdPhaseTable(phase);
    }

    // 更新协同事项
    var collabContent = document.getElementById('rdCollabContent');
    if (collabContent) {
      collabContent.innerHTML = buildRdCollabItems(phase);
    }

    // 更新风险卡片
    var riskContent = document.getElementById('rdRiskCardContent');
    if (riskContent) {
      riskContent.innerHTML = buildRdRiskItems(phase);
    }

    // 恢复勾选状态
    initRDCheckState(phase.id);
    updateRndPhasePct(phase.id);
    // 初始化研发全部完成按钮状态
    initRDAllCompletedState();
  }

  // ========== 研发全部完成（一键勾选所有R&D检查项）==========
  function toggleRDAllCompleted(cb) {
    var checked = cb.checked;
    localStorage.setItem('ess_rd_all_completed', checked ? '1' : '0');
    // ★ 勾选DOM中当前可见的R&D检查项checkbox
    document.querySelectorAll('#rdTableArea input[type="checkbox"]').forEach(function(c) { c.checked = checked; });
    // ★ 持久化所有R&D检查项状态到Store（解决切换标签后状态丢失问题）
    var rdSOP = Store.getRdSOP();
    (rdSOP.phases||[]).forEach(function(p) {
      var allChecks = getMergedChecks('rd', p);
      allChecks.forEach(function(ch) {
        Store.setSOPCheckState(null, 'rd', ch.id, checked, '');
      });
      // 同步更新阶段完成百分比显示
      var el = document.getElementById('phase-pct-' + p.id);
      if (el) el.textContent = checked ? '100%' : '0%';
    });
    // 更新研发整体进度（直接设100%或重新计算）
    if (checked) {
      Store.setPhaseProgress(null, '1_rnd', 100);
    } else {
      updateRndOverallProgress();
    }
    // 刷新L2进度轴
    if (typeof renderProgressAxis === 'function') renderProgressAxis();
    // 提示用户
    if (checked) toast('已标记研发全部完成，所有检查项自动打勾 ✓', 'success');
  }

  // ★ 初始化研发全部完成状态（页面加载/切换时调用）
  function initRDAllCompletedState() {
    var saved = localStorage.getItem('ess_rd_all_completed') === '1';
    var cb = document.getElementById('rdAllCompleted');
    if (cb) cb.checked = saved;
    if (saved) {
      document.querySelectorAll('input[id^="rd-"][type="checkbox"]').forEach(function(c) { c.checked = true; });
      var rdSOP = Store.getRdSOP();
      (rdSOP.phases||[]).forEach(function(p) {
        var el = document.getElementById('phase-pct-' + p.id);
        if (el) el.textContent = '100%';
      });
    }
  }

  // ========== Tab 2: 商务拓展（重构：8种商务模式独立标签+差异化内容+互补进度）==========
  function renderBDTab() {
    var bdModes = [
      {id:'bd-public',name:'公开招标',desc:'依法公开发布招标公告，不特定法人/组织均可投标'},
      {id:'bd-invite',name:'邀请招标',desc:'向3家以上特定供应商发出投标邀请书'},
      {id:'bd-rfq',name:'询价采购',desc:'向3家以上供应商发出询价单，对比报价后确定'},
      {id:'bd-single',name:'单一来源',desc:'因技术/专利等特殊原因只能从唯一供应商采购'},
      {id:'bd-direct',name:'直接采购',desc:'小额/紧急采购，直接向供应商下单'},
      {id:'bd-nego',name:'竞争谈判',desc:'与多家供应商就技术/商务条件进行多轮谈判'},
      {id:'bd-consult',name:'竞争磋商',desc:'就技术方案与供应商进行磋商后择优确定'},
      {id:'bd-agreement',name:'协议供货',desc:'签订长期框架协议，按需分批下单'}
    ];
    var tabsHTML = bdModes.map(function(m,i) {
      return '<button class="sub-tab-btn' + (i===0?' active':'') + '" data-tab-group="bd" data-subtab="' + m.id + '" title="' + m.desc + '">' + m.name + '</button>';
    }).join('');

    var panelsHTML = bdModes.map(function(m,i) {
      return '<div class="sub-tab-panel' + (i===0?' active':'') + '" data-panel="' + m.id + '">' + renderBDModeContent(m.id, m.name) + '<div class="bd-mode-note" style="margin-top:8px;font-size:11px;color:var(--c-gray-500);background:var(--c-gray-50);padding:6px 10px;border-radius:4px;">📌 <strong>' + m.name + '</strong>：' + m.desc + '</div></div>';
    }).join('');

    return '<div class="tab-toolbar-row">'
      + '<div class="sub-tab-nav bd-sub-tabs" id="bdSubTabs">' + tabsHTML + '</div>'
      + '<div class="tab-toolbar-links">'
      + '<span class="bd-progress-hint" title="各商务模式独立计算进度，取最高值作为L2总进度。原因：实际项目只选一种主模式（公开招标/邀请招标互斥），其余辅助模式进度通常较低。" style="font-size:11px;color:var(--c-gray-400);cursor:help;">ⓘ 进度规则</span>'
      + '<a href="https://adan-1983.github.io/ess-expert-system/" target="_blank" class="btn btn-sm">🔗 解决方案 ↗</a>'
      + '<a href="https://adan-1983.github.io/ess-quotation-system/" target="_blank" class="btn btn-sm btn-primary">🔗 ESS报价 ↗</a>'
      + '</div></div>'
      + '<div id="bdSubContentArea">' + panelsHTML + '</div>';
  }

  // 8种商务模式数据结构（差异化进度节点+协同事项+风险提示）
  var BD_MODE_DATA = {
    'bd-public': {
      steps:[{id:'1',name:'客户获取/商机识别'},{id:'2',name:'技术交流/解决方案'},{id:'3',name:'报价/商务谈判'},{id:'4',name:'投标/评标'},{id:'5',name:'中标通知/公示'},{id:'6',name:'合同签订/履约保函'}],
      items:[
        {item:'技术标中交付方案评审',owner:'方案工程师',deadline:'标前评审',status:'pending'},
        {item:'商务标报价与交付成本对齐',owner:'商务经理',deadline:'报价阶段',status:'warn'},
        {item:'FAT/SAT要求写入合同条款',owner:'交付工程师',deadline:'合同签订前',status:'pending'},
        {item:'履约保函/质保金条款确认',owner:'商务经理',deadline:'投标前',status:'warn'},
        {item:'合同交付条款法务联合评审',owner:'法务',deadline:'签约前',status:'pending'}
      ],
      risks:[{level:'high',text:'评标不透明→严格按《招标投标法》流程执行'},{level:'high',text:'交付条款遗漏→法律+交付团队联合评审'},{level:'medium',text:'报价与实际成本偏差→同步ESS报价系统核算'}]
    },
    'bd-invite': {
      steps:[{id:'1',name:'合格供应商筛选'},{id:'2',name:'邀请函编制发放'},{id:'3',name:'资格预审/答疑'},{id:'4',name:'技术/商务标评审'},{id:'5',name:'中标确定/通知'},{id:'6',name:'合同签订'}],
      items:[
        {item:'短名单供应商交付能力评估',owner:'交付经理',deadline:'筛选阶段',status:'pending'},
        {item:'技术方案与现场条件匹配验证',owner:'方案工程师',deadline:'评审阶段',status:'warn'},
        {item:'受邀供应商产能/交期确认',owner:'采购',deadline:'资格预审时',status:'pending'},
        {item:'过往项目交付业绩核实',owner:'商务',deadline:'评审前',status:'pending'}
      ],
      risks:[{level:'high',text:'供应商能力高估→实地考察工厂+过往项目回访'},{level:'medium',text:'邀请数量不足(<3家)→扩大候选范围'},{level:'low',text:'串标风险→独立评审+回避制度'}]
    },
    'bd-rfq': {
      steps:[{id:'1',name:'询价文件编制'},{id:'2',name:'询价单发放'},{id:'3',name:'供应商报价收集'},{id:'4',name:'技术/商务对比评审'},{id:'5',name:'议价确认/合同签订'}],
      items:[
        {item:'询价文件中交付条款明确',owner:'交付工程师',deadline:'编制阶段',status:'pending'},
        {item:'供应商资质(ISO/产能)审核',owner:'采购',deadline:'报价前',status:'warn'},
        {item:'报价对比分析含交付成本',owner:'商务经理',deadline:'评审阶段',status:'pending'}
      ],
      risks:[{level:'high',text:'低价中标质量隐患→设定合理基准价'},{level:'medium',text:'供应商虛假报价→资质实地核查'},{level:'medium',text:'报价有效期过期→设定≥30天有效期'}]
    },
    'bd-single': {
      steps:[{id:'1',name:'供应商评估认证'},{id:'2',name:'技术方案确认'},{id:'3',name:'价格谈判论证'},{id:'4',name:'合同签订'}],
      items:[
        {item:'供应商唯一性论证文件编制',owner:'商务经理',deadline:'采购启动前',status:'warn'},
        {item:'价格合理性第三方审计',owner:'财务',deadline:'谈判阶段',status:'pending'},
        {item:'交付条款谈判纪要留存',owner:'法务',deadline:'谈判中',status:'pending'},
        {item:'后续替代供应商开发计划',owner:'采购',deadline:'长期',status:'info'}
      ],
      risks:[{level:'high',text:'供应商垄断风险→合同增加保底条款'},{level:'high',text:'价格偏高→引入第三方审计'},{level:'medium',text:'交期不可控→提前储备安全库存'}]
    },
    'bd-direct': {
      steps:[{id:'1',name:'供应商选择'},{id:'2',name:'询价/比价'},{id:'3',name:'合同签订/下单'}],
      items:[
        {item:'至少三方比价记录留存',owner:'采购',deadline:'下单前',status:'warn'},
        {item:'交付周期书面确认',owner:'采购',deadline:'下单时',status:'pending'},
        {item:'质量/验收标准明确',owner:'质量工程师',deadline:'下单时',status:'pending'}
      ],
      risks:[{level:'high',text:'未经比价→强制三方比价制度'},{level:'medium',text:'质量不可控→进厂IQC必检'},{level:'medium',text:'交期延误→合同明确违约金条款'}]
    },
    'bd-nego': {
      steps:[{id:'1',name:'谈判公告发布'},{id:'2',name:'响应文件接收评审'},{id:'3',name:'多轮谈判(技术/商务)'},{id:'4',name:'最终报价评审'},{id:'5',name:'合同签订'}],
      items:[
        {item:'谈判中交付方案调整记录',owner:'交付经理',deadline:'谈判中',status:'pending'},
        {item:'最终报价与交付TCO对照',owner:'商务经理',deadline:'终轮',status:'warn'},
        {item:'谈判纪要三方签字留存',owner:'法务',deadline:'每轮谈判后',status:'pending'}
      ],
      risks:[{level:'high',text:'谈判周期过长→设定截止期限'},{level:'medium',text:'交付方案频繁变更→关键条款冻结节点'},{level:'low',text:'信息不对称→谈判前充分准备'}]
    },
    'bd-consult': {
      steps:[{id:'1',name:'磋商公告发布'},{id:'2',name:'响应文件初审'},{id:'3',name:'磋商谈判(方案迭代)'},{id:'4',name:'最终方案确认'},{id:'5',name:'合同签订'}],
      items:[
        {item:'磋商中技术方案迭代记录',owner:'方案工程师',deadline:'磋商中',status:'pending'},
        {item:'最终方案与交付能力匹配确认',owner:'交付经理',deadline:'方案确认前',status:'warn'},
        {item:'磋商纪要三方签字留存',owner:'法务',deadline:'每轮磋商后',status:'pending'}
      ],
      risks:[{level:'high',text:'方案反复变更→设定磋商轮次上限(≤3轮)'},{level:'medium',text:'时间成本过高→磋商前充分准备技术方案'},{level:'low',text:'供应商响应不积极→扩大公告范围'}]
    },
    'bd-agreement': {
      steps:[{id:'1',name:'入围协议签署'},{id:'2',name:'订单下达'},{id:'3',name:'交付执行/验收'}],
      items:[
        {item:'协议物资清单与项目需求对齐',owner:'采购',deadline:'协议签署前',status:'pending'},
        {item:'年度采购量预估与交期协调',owner:'商务经理',deadline:'签约时',status:'warn'},
        {item:'协议价格调价机制确认',owner:'商务',deadline:'签约时',status:'pending'},
        {item:'安全库存与最小起订量确定',owner:'仓库',deadline:'签约后',status:'info'}
      ],
      risks:[{level:'high',text:'协议范围不明确→清晰SOW+物料清单'},{level:'medium',text:'交期集中冲突→分批排单+优先级管理'},{level:'medium',text:'价格波动风险→季度调价机制'}]
    }
  };

  function renderBDModeContent(modeId, modeName) {
    var data = BD_MODE_DATA[modeId] || BD_MODE_DATA['bd-public'];
    var prefix = modeId;
    return buildThreeColLayout(
      buildProgressCard(prefix, modeName + '进度', data.steps, '2_bd'),
      buildDeliveryTableCard(modeName + '·交付协同', data.items),
      buildRiskCard('2_bd_' + modeId, data.risks)
    );
  }

  // ========== Tab 3: 生产制造（重构：行业最佳实践）==========
  function renderMfgTab() {
    const subTabs = [
      {id:'mfg-order',name:'订单转化&排产'},{id:'mfg-iqc',name:'来料检验IQC'},{id:'mfg-assemble',name:'生产装配'},
      {id:'mfg-qc',name:'质量管控IPQC/FQC'},{id:'mfg-fat',name:'FAT工厂验收'},{id:'mfg-pack',name:'包装发货'}
    ];
    // 右侧：风险提示与对策 + 计划vs实际进度对比图（默认展开）
    var mfgRightHTML = '<div style="flex:0 0 280px;display:flex;flex-direction:column;gap:12px;">'
      + '<div class="card card-foldable open"><div class="card-header" onclick="App.toggleCardFold(this)">⚠ 风险提示与对策</div>'
      + '<div class="card-foldable-content open" id="mfgRiskCardContent"><div style="color:var(--c-gray-400);font-size:12px;padding:8px;">切换子标签查看对应风险</div></div></div>'
      + '<div class="card card-foldable open"><div class="card-header" onclick="App.toggleCardFold(this)">📊 计划 vs 实际进度</div>'
      + '<div class="card-foldable-content open" style="padding:10px;"><canvas id="mfgChart"></canvas></div></div>'
      + '</div>';

    return `
      <div class="tab-toolbar-row">
        <div class="sub-tab-nav mfg-sub-tabs" id="mfgSubTabs">
          ${subTabs.map(st => `<button class="sub-tab-btn${st.id==='mfg-fat'?' active':''}" data-tab-group="mfg" data-subtab="${st.id}">${st.name}</button>`).join('')}
        </div>
        <div class="mfg-all-completed-wrap" style="margin-left:auto;display:flex;align-items:center;">
          <label style="display:flex;align-items:center;gap:5px;cursor:pointer;font-size:12px;color:#666;white-space:nowrap;">
            <input type="checkbox" id="mfgAllCompleted" onchange="App.toggleMfgAllCompleted(this)" style="width:15px;height:15px;cursor:pointer;">
            订单全部完成
          </label>
        </div>
      </div>
      <div style="display:flex;gap:16px;margin-top:12px;align-items:flex-start;">
        <div id="mfgSubContentArea" style="flex:1;min-width:0;">
          <div class="sub-tab-panel active" data-panel="mfg-fat">${renderMfgFATContent()}</div>
          <div class="sub-tab-panel" data-panel="mfg-order">${renderMfgOrderContent()}</div>
          <div class="sub-tab-panel" data-panel="mfg-iqc">${renderMfgIQCContent()}</div>
          <div class="sub-tab-panel" data-panel="mfg-assemble">${renderMfgAssembleContent()}</div>
          <div class="sub-tab-panel" data-panel="mfg-qc">${renderMfgQCContent()}</div>
          <div class="sub-tab-panel" data-panel="mfg-pack">${renderMfgPackContent()}</div>
        </div>
        ${mfgRightHTML}
      </div>
    `;
  }

  function renderMfgOrderContent() {
    const p = Store.getSelectedProject();
    return buildTwoColLayout(
      buildProgressCard('mfg-ord','订单转化与排产进度',[
        {id:'mo1',name:'EPC合同转化生产订单'},{id:'mo2',name:'BOM核对与物料齐套计划'},
        {id:'mo3',name:'生产排产计划制定(批次/交期)'},{id:'mo4',name:'产能评估不足进行增点'},{id:'mo5',name:'生产指令下达不间断跟踪'}
      ]),
      buildDeliveryTableCard('生产计划与交付协同',[
        {item:`当前项目(${p?.cabinetCount||48}柜)分批排产计划`,owner:'生产计划',deadline:'首批16柜/后续32柜',status:'info'},
        {item:'工厂标准交期(16柜/批次)',owner:'生产计划',deadline:'2~3月/批次',status:'warn'},
        {item:`项目总交期预测`,owner:'项目经理',deadline:`${Math.ceil((p?.cabinetCount||48)/16)*2}~${Math.ceil((p?.cabinetCount||48)/16)*3}月`,status:'warn'},
        {item:'关键长产物(314Ah电芯)到货计划',owner:'采购',deadline:'排产前2周',status:'pending'},
        {item:'液冷系统到货计划',owner:'采购',deadline:'装配前10天',status:'pending'}
      ])
    );
  }

  function renderMfgIQCContent() {
    // 左栏：IQC检验项清单（占55%）
    var iqcLeft = '<div class="card" style="height:100%;"><div class="card-header" style="display:flex;align-items:center;justify-content:flex-start;">'
      + '<input type="checkbox" id="selall-iqc" onchange="App.toggleIQCSelectAll(this)" title="全选/全不选" style="width:16px;height:16px;cursor:pointer;accent-color:var(--c-primary);margin-right:6px;flex-shrink:0;">'
      + '<span>来料检验IQC检验项清单</span></div>'
      + '<div class="card-body scrollable">'
      + '<table class="delivery-table iqc-table"><thead><tr>'
      + '<th style="width:36px;text-align:center;"><input type="checkbox" id="selall-iqc-header" onchange="App.toggleIQCSelectAll(this)" title="全选" style="width:16px;height:16px;cursor:pointer;"></th>'
      + '<th>检验项目</th><th>检验方法</th><th>合格标准</th><th>抽样比例</th></tr></thead><tbody>'
      + [
          {id:'iqc1',item:'电芯(314Ah LFP)',method:'外观+容量+内阻',standard:'外观无损、容值在公差内',ratio:'5%'},
          {id:'iqc2',item:'电芯模组(PACK)',method:'外观+尺寸+纳克+安全检查',standard:'纳克符合图纸、防火级别正确',ratio:'10%'},
          {id:'iqc3',item:'PCS变流器',method:'外观+型式试验报告+功能检验',standard:'型式试验通过、参数与技术协议一致',ratio:'100%'},
          {id:'iqc4',item:'BMS主控板/BMU',method:'固件版本核对+功能测试',standard:'软件版本一致、通信功能正常',ratio:'100%'},
          {id:'iqc5',item:'铜母排/电线',method:'材质证书核对+外观+尺寸',standard:'国标标示、截面符合要求',ratio:'3%'},
          {id:'iqc6',item:'电缆端子/连接器',method:'规格型号核对+导电阻值',standard:'规格符合、阻值在公差内',ratio:'2%'},
          {id:'iqc7',item:'铜刷线/通讯线缆',method:'外观+居安电阻值+屏蔽性检验',standard:'屏蔽性、居安电符合GB/T',ratio:'2%'},
          {id:'iqc8',item:'液冷管理组件(冷机/水泵/管路)',method:'外观+型号+密封性',standard:'无渗漏、密封符合IP级别',ratio:'5%'},
          {id:'iqc9',item:'消防组件',method:'3C认证核对+功能检测',standard:'3C认证有效、功能正常',ratio:'100%'},
          {id:'iqc10',item:'集装箱箱体/95角件',method:'尺寸+缝焊质量+防潮涂料',standard:'焊接质量符合规范',ratio:'100%'}
        ].map(function(iq){ return '<tr><td style="text-align:center;"><input type="checkbox" class="iqc-checkbox" id="' + iq.id + '"></td><td>' + iq.item + '</td><td>' + iq.method + '</td><td>' + iq.standard + '</td><td>' + iq.ratio + '</td></tr>'; }).join('')
      + '</tbody></table></div></div>';
    // 右栏：协同信息
    var iqcRight = '<div style="display:flex;flex-direction:column;gap:12px;">'
      + buildDeliveryTableCard('IQC与交付协同',[
        {item:'来料不合格处理(NCR)流程',owner:'质量工程师',deadline:'到货4小时内',status:'warn'},
        {item:'供应商质量评价月报',owner:'采购',deadline:'每月一',status:'pending'},
        {item:'关键长物料安全库存',owner:'仓库',deadline:'持续',status:'info'},
        {item:'IQC检测设备校准有效期',owner:'质量工程师',deadline:'每季度',status:'pending'}
      ])
      + '</div>';
    return '<div style="display:grid;grid-template-columns:55% 1fr;gap:16px;">' + iqcLeft + iqcRight + '</div>';
  }

  function renderMfgAssembleContent() {
    return buildTwoColLayout(
      buildProgressCard('mfg-asm','生产装配进度',[
        {id:'ma1',name:'箱体焊接组装(闸门+版面)'},{id:'ma2',name:'电芯模组安装(程序化操作)'},{id:'ma3',name:'BMS系统安装与接线'},
        {id:'ma4',name:'PCS安装与母排连接'},{id:'ma5',name:'液冷管理系统安装'},{id:'ma6',name:'消防系统安装'},
        {id:'ma7',name:'综合布线与线束固定'},{id:'ma8',name:'整机外观检查与擦拭'}
      ]),
      buildDeliveryTableCard('装配进度与交付协同',[
        {item:'焊接质量检查(熔深+完整性)',owner:'工艺工程师',deadline:'每点检查',status:'pending'},
        {item:'紧固力矩合格率检查',owner:'质量工程师',deadline:'抽检比例≥30%',status:'warn'},
        {item:'过程质量控制点(IPQC)',owner:'质量工程师',deadline:'全流程',status:'pending'},
        {item:'生产环境控制(温度/洁净度)',owner:'生产主管',deadline:'每日',status:'info'}
      ])
    );
  }

  function renderMfgQCContent() {
    // 左栏：IPQC/FQC/OQC检验点（占55%）
    var qcLeft = '<div class="card" style="height:100%;"><div class="card-header" style="display:flex;align-items:center;justify-content:flex-start;">'
      + '<input type="checkbox" id="selall-qc" onchange="App.toggleQCSelectAll(this)" title="全选/全不选" style="width:16px;height:16px;cursor:pointer;accent-color:var(--c-primary);margin-right:6px;flex-shrink:0;">'
      + '<span>质量控制 IPQC/FQC/OQC 检验点</span></div>'
      + '<div class="card-body scrollable">'
      + '<table class="delivery-table qc-table"><thead><tr>'
      + '<th style="width:36px;text-align:center;"><input type="checkbox" id="selall-qc-header" onchange="App.toggleQCSelectAll(this)" title="全选" style="width:16px;height:16px;cursor:pointer;"></th>'
      + '<th>检验环节</th><th>检验内容</th><th>检验频率</th><th>记录</th></tr></thead><tbody>'
      + [
{id:'qc1',phase:'IPQC',content:'焊接点抽检(熔深+外观)',freq:'每点必检',record:'焊接检验表'},
{id:'qc2',phase:'IPQC',content:'紧固力矩复测(力矩扳手)',freq:'抽检≥30%',record:'紧固力矩检验表'},
{id:'qc3',phase:'IPQC',content:'工艺执行情况',freq:'巡视每小时',record:'IPQC巡视记录'},
{id:'qc4',phase:'FQC',content:'整机外观检查(漂伤/划伤/标签)',freq:'100%',record:'FQC检验报告'},
{id:'qc5',phase:'FQC',content:'电气安全检验(绝缘/接地/耐压)',freq:'100%',record:'电气安全检验表'},
{id:'qc6',phase:'FQC',content:'功能检测(BMS/PCS/EMS/EMC)',freq:'100%',record:'功能检测报告'},
{id:'qc7',phase:'OQC',content:'包装前最终检查(全面)',freq:'100%',record:'OQC出历报告'},
{id:'qc8',phase:'OQC',content:'随机文件(合格证+铭牌+说明书)',freq:'100%',record:'文件核对清单'}
        ].map(function(q){ return '<tr><td style="text-align:center;"><input type="checkbox" class="qc-checkbox" id="' + q.id + '"></td><td><strong>' + q.phase + '</strong>: ' + q.content + '</td><td>' + q.freq + '</td><td>' + q.record + '</td><td><input class="inline-input" placeholder="备注" style="width:80px;"></td></tr>'; }).join('')
      + '</tbody></table></div></div>';
    // 右栏：协同信息
    var qcRight = '<div style="display:flex;flex-direction:column;gap:12px;">'
      + buildDeliveryTableCard('质量控制与交付协同',[
        {item:'NCR异常处理开单率监控',owner:'质量经理',deadline:'每周统计',status:'warn'},
        {item:'工程修改记录(ECR)管理',owner:'研发',deadline:'发现即提交',status:'pending'},
        {item:'FAT前质量复查报告',owner:'质量工程师',deadline:'FAT前2天',status:'pending'},
        {item:'质量问题追踪表(当月开录当月关)',owner:'质量',deadline:'每月更新',status:'info'}
      ])
      + '</div>';
    return '<div style="display:grid;grid-template-columns:55% 1fr;gap:16px;">' + qcLeft + qcRight + '</div>';
  }

  function renderMfgPackContent() {
    return buildTwoColLayout(
      buildProgressCard('mfg-pk','包装发货准备',[
        {id:'mp1',name:'内部清场+清洁检查'},{id:'mp2',name:'防潮/防包装处理(干燥剂)'},{id:'mp3',name:'包装固定(阀锁保护+克拉)'},
        {id:'mp4',name:'附件/备件/文件清单'},{id:'mp5',name:'发货前最终检查(OQC)'}
      ]),
      buildDeliveryTableCard('包装发货与物流协同',[
        {item:'装箱型号核对(定制木箱/阁片箱)',owner:'物流',deadline:'发货前3天',status:'pending'},
        {item:'危险品标签(UN3480 Class 9)',owner:'合规',deadline:'装货时',status:'warn'},
        {item:'装箱列表(MDS化学品+电池品)',owner:'物流',deadline:'装货前',status:'warn'},
        {item:'产品合格证+铭牌照片放入',owner:'质量',deadline:'OQC通过后',status:'pending'}
      ])
    );
  }

  function renderMfgFATContent() {
    var fatSOP = Store.getFatSOP();
    var phases = fatSOP.phases || [];
    // 优先从当前项目读取specs，如果没有则使用FAT SOP中的默认值
    var currentProject = Store.getSelectedProject();
    var specs = (currentProject && currentProject.specs) ? currentProject.specs : (fatSOP.specs || {});

    // ① 规格参数紧凑横条（保持不变）
    var specsBar = '<div style="display:flex;flex-wrap:wrap;gap:6px 16px;padding:8px 12px;background:var(--c-gray-50);border-radius:6px;margin-bottom:12px;border:1px solid var(--c-gray-200);">';
    var specLabels = {ratedEnergy:'额定能量',ratedPower:'额定功率',voltage:'电压等级',weight:'重量',dimensions:'外形尺寸',cooling:'冷却方式',cell:'电芯型号'};
    for (var k in specs) { specsBar += '<span style="font-size:12px;"><strong>' + (specLabels[k]||k) + ':</strong> ' + specs[k] + '</span>'; }
    specsBar += '</div>';

    // ② 水平标签栏（独立class，避免被bindSubTabEvents劫持）+ 最右侧FAT全部合格按钮
    var tabNavHTML = '<div class="fat-sub-tabs" id="fatSubTabs">'
      + phases.map(function(p, idx) {
          return '<button class="fat-phase-btn' + (idx===0?' active':'') + '" data-fat-phase="' + p.id + '" onclick="App.switchFatPhase(this)">' + p.name + '</button>';
        }).join('')
      + '<label class="fat-all-passed-wrap" title="勾选代表所有测试项全部合格"><input type="checkbox" id="fatAllPassed" onchange="App.toggleFATAllPassed(this)"> FAT全部合格</label>'
      + '</div>';

    // ③ 公共表格展示区（默认显示首个phase：前置条件）
    var firstPhase = phases[0];
    var tableAreaHTML = '<div id="fatTableArea">' + buildFatPhaseTable(firstPhase) + '</div>';

    // ④ 返回：规格条全宽 + 标签+表格区（风险由外层renderMfgTab统一提供）
    return specsBar
      + tabNavHTML
      + tableAreaHTML;
  }

  // 构建单个FAT phase的详细表格（支持自定义增删+参考标准编号）
  function buildFatPhaseTable(phase) {
    if (!phase || !phase.checks || phase.checks.length === 0) {
      return '<div class="card"><div class="card-body text-muted">暂无检查项数据</div></div>';
    }
    // 合并内置检查项和用户自定义检查项
    var allChecks = getMergedChecks('fat', phase);
    return `
      <div class="card">
        <div class="card-header" style="display:flex;align-items:center;justify-content:space-between;">
          <span>${phase.name} <span class="text-xs text-muted">(共${allChecks.length}项 | ${phase.standardHours||'—'} | ${phase.canParallel?'可并行':'不可并行'})</span></span>
          <div style="display:flex;align-items:center;gap:8px;">
            ${phase.witness ? '<span class="text-xs" style="color:var(--c-primary);">👤 '+phase.witness+'</span>' : ''}
            <button class="btn btn-sm" onclick="App.addCustomCheck('fat','${phase.id}')" style="font-size:12px;padding:4px 10px;">+ 添加检查项</button>
          </div>
        </div>
        <div class="card-body" style="padding:0;overflow-x:auto;">
          <table class="delivery-table">
            <thead><tr>
              <th style="width:36px;text-align:center;"><input type="checkbox" onchange="App.toggleFATSelectAll(this,'${phase.id}')" title="全选/全不选" style="width:16px;height:16px;cursor:pointer;accent-color:var(--c-primary);"></th>
              <th style="min-width:130px;">检查项目</th>
              <th style="min-width:200px;">具体内容/要求</th>
              <th style="min-width:120px;">验收标准</th>
              <th style="min-width:130px;">参考标准编号</th>
              <th style="min-width:110px;">检查工具</th>
              <th style="width:60px;">类型</th>
              <th style="width:65px;">验收结果</th>
              <th style="width:75px;">备注</th>
            </tr></thead>
            <tbody>
              ${allChecks.map(function(ch) {
                var isCustom = ch.id.indexOf('-custom-') >= 0;
                return `<tr id="row-${ch.id}">
                  <td style="text-align:center;"><input type="checkbox" id="${ch.id}" onchange="App.onFATCheck(this);App.updateMFGOverallProgress()"></td>
                  <td>${ch.item}</td>
                  <td style="font-size:11px;color:var(--c-gray-600);">${ch.content||'—'}</td>
                  <td style="font-size:11px;">${ch.standard||'-'}</td>
                  <td style="font-size:11px;color:var(--c-primary);">${ch.refStd||'-'}</td>
                  <td style="font-size:11px;color:var(--c-gray-500);">${ch.tool||'-'}</td>
                  <td><span class="badge badge-${ch.type==='关键'?'danger':ch.type==='重要'?'warning':'info'}" style="font-size:10px;padding:1px 6px;border-radius:3px;">${ch.type||'一般'}</span></td>
                  <td><select class="result-select" id="result-${ch.id}" style="font-size:11px;padding:2px 4px;border-radius:3px;border:1px solid var(--c-gray-200);"><option>待定</option><option>合格</option><option>不合格</option></select></td>
                  <td><input class="inline-input" style="width:55px;" id="note-${ch.id}" placeholder="备注" onchange="">${isCustom ? ' <button class="btn btn-sm btn-outline" onclick="App.removeCustomCheck(\'fat\',\'' + phase.id + '\',\'' + ch.id + '\')" title="删除此项" style="padding:0 3px;font-size:10px;line-height:1;">✕</button>' : ''}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
          <div style="padding:8px 12px;font-size:12px;color:var(--c-gray-600);border-top:1px solid var(--c-gray-100);">
            本阶段完成: <strong id="phase-pct-${phase.id}">0%</strong>
            <span style="float:right;color:var(--c-gray-400);">记录输出: ${allChecks[0]?allChecks[0].record||'-':'-'}</span>
          </div>
        </div>
      </div>`;
  }

  // ========== Tab 4: 物流运输（修复：链接位置+次级标签内容）==========
  function renderLogisticsTab() {
    const subTabs = [
      {id:'log-overview',name:'发货概况'},{id:'log-progress',name:'发运进度'},
      {id:'log-track',name:'批次跟踪'},{id:'log-alert',name:'异常预警'}
    ];
    // 右侧：风险提示与对策 + 计划vs实际进度对比图（默认展开）
    var logRightHTML = '<div style="flex:0 0 280px;display:flex;flex-direction:column;gap:12px;">'
      + '<div class="card card-foldable open" id="logisticsRiskCard"><div class="card-header" onclick="App.toggleCardFold(this)">⚠ 风险提示与对策</div>'
      + '<div class="card-foldable-content open"><div style="color:var(--c-gray-400);font-size:12px;padding:8px;">切换子标签查看对应风险</div></div></div>'
      + '<div class="card card-foldable open"><div class="card-header" onclick="App.toggleCardFold(this)">📊 发货/到货 计划 vs 实际进度</div>'
      + '<div class="card-foldable-content open" style="padding:10px;"><canvas id="logisticsChart"></canvas></div></div>'
      + '</div>';

    return `
      <div class="tab-toolbar-row">
        <div class="sub-tab-nav log-sub-tabs" id="logSubTabs">
          ${subTabs.map(st => `<button class="sub-tab-btn${st.id==='log-overview'?' active':''}" data-tab-group="log" data-subtab="${st.id}">${st.name}</button>`).join('')}
        </div>
        <div class="tab-toolbar-links">
          <a href="https://adan-1983.github.io/ess-shipping-calculator/" target="_blank" class="btn btn-sm btn-primary">🔗 运输策略计算器 ↗</a>
        </div>
      </div>
      <div style="display:flex;gap:16px;margin-top:12px;align-items:flex-start;">
        <div id="logSubContentArea" style="flex:1;min-width:0;">
          <div class="sub-tab-panel active" data-panel="log-overview">${renderLogOverviewContent()}</div>
          <div class="sub-tab-panel" data-panel="log-progress">${renderLogProgressContent()}</div>
          <div class="sub-tab-panel" data-panel="log-track">${renderLogTrackContent()}</div>
          <div class="sub-tab-panel" data-panel="log-alert">${renderLogAlertContent()}</div>
        </div>
        ${logRightHTML}
      </div>
    `;
  }

  function renderLogOverviewContent() {
    const p = Store.getSelectedProject();
    return buildTwoColLayout(
      `<div class="card"><div class="card-header">发货概况 <span class="badge badge-progress">共${p?.cabinetCount||48}柜</span></div><div class="card-body">
        <table class="delivery-table"><tbody>
        ${[
{name:'发货批次',value:`${Math.ceil((p?.cabinetCount||48)/16)}批(${p?.cabinetCount||48}柜)`},
{name:'每批容量',value:'16柜/ArcBank1.0-5.016MWh'},{name:'运输路线',value:p?.delivery?.shippingRoute||'上海→孟买(海运约25天)'},
{name:'包装方式',value:'阁片箱/定制木箱(防潮防水)'},{name:'危险等级',value:'UN3480 Class 9 危险品'}
        ].map(r=>`<tr><td style="font-weight:500;width:35%">${r.name}</td><td><strong>${r.value}</strong></td></tr>`).join('')}
        </tbody></table></div></div>`,
      buildDeliveryTableCard('物流计划与交付协同',[
        {item:'发货批次与生产发货计划对齐',owner:'物流专员',deadline:'发货前1周',status:'pending'},
        {item:'BIS认证/进口许可证',owner:'合规专员',deadline:'发货前30天',status:'warn'},
        {item:'危险品运输申报(UN3480)',owner:'物流专员',deadline:'订舱时',status:'warn'},
        {item:'印度内陆运输预案',owner:'物流专员',deadline:'到港前7天',status:'pending'}
      ])
    );
  }

  function renderLogProgressContent() {
    return buildTwoColLayout(
      buildProgressCard('log-prog','物流运输进度',[
        {id:'lp1',name:'发货计划制定'},{id:'lp2',name:'订舱/报关(国际)'},{id:'lp3',name:'装船/发车'},
        {id:'lp4',name:'在途运输'},{id:'lp5',name:'到港/到站清关'},{id:'lp6',name:'内陆转运/到货'}
      ]),
      buildDeliveryTableCard('发运进度跟踪与交付协同',[
        {item:'海运柜号/开船日期/预计到港日期',owner:'物流',deadline:'订舱时确认',status:'pending'},
        {item:'清关进度跟踪',owner:'清关代理',deadline:'每日更新',status:'warn'},
        {item:'运输保险状态确认',owner:'物流',deadline:'发货时',status:'info'}])
    );
  }

  function renderLogTrackContent() {
    const p = Store.getSelectedProject();
    const batches = Math.ceil((p?.cabinetCount||48)/16);
    // 左栏：批次跟踪（占60%）
    var trackLeft = '<div class="card" style="height:100%;"><div class="card-header" style="display:flex;align-items:center;gap:8px;">'
      + '<input type="checkbox" id="selall-batch" onchange="App.toggleBatchSelectAll(this)" title="全选/全不选" style="width:16px;height:16px;cursor:pointer;accent-color:var(--c-primary);">'
      + '<span>批次跟踪</span> <span class="badge badge-info">共' + batches + '批</span></div>'
      + '<div class="card-body scrollable">'
      + '<table class="delivery-table batch-table" style="min-width:700px;"><thead><tr>'
      + '<th style="width:36px;text-align:center;"><input type="checkbox" id="selall-batch-header" onchange="App.toggleBatchSelectAll(this)" title="全选" style="width:16px;height:16px;cursor:pointer;"></th>'
      + '<th>批次</th><th>柜号</th><th>状态</th><th>预计发货</th><th>实际发货</th><th>到货</th><th>备注</th></tr></thead><tbody>'
      + Array.from({length:batches},function(_,i){ return '<tr><td style="text-align:center;"><input type="checkbox" class="batch-checkbox" id="batch-' + (i+1) + '"></td>'
        + '<td>第' + (i+1) + '批</td><td>#' + (i*16+1) + '-#' + Math.min((i+1)*16,p?.cabinetCount||48) + '</td>'
        + '<td><select class="inline-input" style="width:90px"><option>计划中</option><option>已发货</option><option>在途</option><option>已到货</option></select></td>'
        + '<td><input type="date" class="inline-input" style="width:110px"></td><td><input type="date" class="inline-input" style="width:110px"></td>'
        + '<td><input type="date" class="inline-input" style="width:110px"></td><td><input class="inline-input" placeholder="备注" style="width:90px;"></td></tr>'; }).join('')
      + '</tbody></table></div></div>';
    // 右栏：协同信息（占40%）
    var trackRight = '<div style="display:flex;flex-direction:column;gap:12px;">'
      + buildDeliveryTableCard('批次管理与交付协同',[
        {item:'批次发货通知(客户/监理)',owner:'物流',deadline:'发货前',status:'pending'},
        {item:'每批到货验收报告',owner:'交付工程师',deadline:'到货当天',status:'pending'},
        {item:'运输损坏记录与索赔',owner:'物流',deadline:'发现即报',status:'warn'}])
      + '</div>';
    return '<div style="display:grid;grid-template-columns:60% 1fr;gap:16px;">' + trackLeft + trackRight + '</div>';
  }

  function renderLogAlertContent() {
    return buildTwoColLayout(
      buildProgressCard('log-alt','异常预警检查项',[
        {id:'la1',name:'运输延误预警(≥3天未通知)'},{id:'la2',name:'清关阻塞/罚款风险'},{id:'la3',name:'货物损坏识别'},
        {id:'la4',name:'危险品泄漏检查'},{id:'la5',name:'印度内陆运输合规性确认'}
      ]),
      buildDeliveryTableCard('异常管理与应急',[
        {item:'运输延误≥3天未通知',owner:'物流',deadline:'立即通知',status:'danger'},
        {item:'清关被报关关',owner:'合规',deadline:'立即处理',status:'danger'},
        {item:'货物水渍损坏',owner:'物流',deadline:'立即记录+报险',status:'warn'},
        {item:'危险品标签脱落',owner:'合规',deadline:'装货前核对',status:'warn'}])
    );
  }

  // ========== Tab4 物流风险联动数据 & 刷新函数 ==========
  var logisticsRiskMap = {
    'log-overview': [
      {level:'high',text:'国际海运延误→预留14天缓冲期+实时跟踪'},
      {level:'high',text:'目的港清关异常→提前准备BIS/DGFT全套文件'},
      {level:'medium',text:'印度内陆运输限重→公路限高限重提前勘路'}
    ],
    'log-progress': [
      {level:'high',text:'订舱延迟→提前30天锁定舱位'},
      {level:'medium',text:'报关单证不全→提前7天完成单证预审'},
      {level:'low',text:'在途信息断层→要求货代提供实时GPS/船位跟踪'}
    ],
    'log-track': [
      {level:'high',text:'国际海运延误→预留14天缓冲期+实时跟踪'},
      {level:'medium',text:'批次到货信息不同步→建立到货确认群/日报机制'},
      {level:'high',text:'运输损坏索赔超期→到货24h内完成外观检查+拍照存档'}
    ],
    'log-alert': [
      {level:'high',text:'国际海运延误→预留14天缓冲期'},
      {level:'high',text:'目的港清关异常→提前准备BIS/DGFT全套文件'},
      {level:'medium',text:'危险品申报不合规→LFP电池UN3480 Class 9'}
    ]
  };

  function refreshLogisticsRiskCard(subtabId) {
    var container = document.getElementById('logisticsRiskCard');
    if (!container) {
      // 尝试在右侧区域内查找风险卡片
      container = document.querySelector('#logSubContentArea').parentElement.nextElementSibling.querySelector('.card-foldable');
      if (!container || !container.querySelector('.card-header')?.textContent?.includes('风险')) return;
    }
    var risks = logisticsRiskMap[subtabId] || logisticsRiskMap['log-overview'];
    var content = container.querySelector('.card-foldable-content');
    if (!content) return;
    content.innerHTML = risks.map(function(r) {
      return '<div class="risk-item risk-' + r.level + '"><span class="risk-icon">' + (r.level==='high'?'🔴':r.level==='medium'?'🟡':'🔵') + '</span><span>' + r.text + '</span></div>';
    }).join('');
  }

  // ========== Tab 5: 现场安装（完整版·SOP内置）==========
  function renderInstallTab() {
    const sop = Store.getInstallSOP();
    const phases = sop.phases || [];
    if (!phases || phases.length === 0) {
      return buildThreeColLayout(buildPlaceholderCard('安装SOP数据加载中...'),buildPlaceholderCard('请等待数据加载完成'),buildPlaceholderCard(''));
    }
    const subTabs = phases.map(p => ({ id: 'ins-' + p.sortOrder, name: p.name }));
    
    function getCheckMethod(ch) {
      if (ch.method) return ch.method;
      if (ch.type === '关键') return '仪器测量';
      if (ch.type === '重要') return '目视+量具';
      return '目视';
    }
    
    let subTabContents = phases.map(phase => {
      var allChecks = getMergedChecks('install', phase);
      return `
      <div class="sub-tab-panel${phase.sortOrder===1?' active':''}" data-panel="ins-${phase.sortOrder}">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;font-size:12px;color:var(--c-gray-600);">
          <span>检查项 <strong>${allChecks.length}</strong> 项 | 点击勾选确认通过</span>
          <button class="btn btn-sm" onclick="App.addCustomCheck('install','${phase.id}')" style="font-size:12px;padding:4px 10px;">+ 添加检查项</button>
        </div>
        <table class="delivery-table">
          <thead><tr>
            <th style="width:36px;text-align:center;"><input type="checkbox" id="selall-ins-${phase.id}" onchange="App.toggleInstallSelectAll(this,'${phase.id}')" title="全选/全不选" style="width:16px;height:16px;cursor:pointer;accent-color:var(--c-primary);"></th>
            <th>检查项目</th>
            <th style="min-width:160px;">具体内容/要求</th>
            <th style="min-width:90px;">检查方法</th>
            <th style="min-width:100px;">检查工具</th>
            <th style="min-width:110px;">验收标准</th>
            <th style="width:70px;">验收结果</th>
            <th style="width:80px;text-align:right;padding-right:16px;">备注</th>
          </tr></thead>
          <tbody>
            ${allChecks.map(ch => {
              var isCustom = ch.id.indexOf('-custom-') >= 0;
              return `
              <tr id="row-${ch.id}">
                <td style="text-align:center;"><input type="checkbox" id="${ch.id}" onchange="App.onInstallCheck(this,'${phase.id}','${ch.id}')" ${isInstallChecked(ch.id)?'checked':''}></td>
                <td>${ch.item}</td>
                <td style="font-size:11px;color:var(--c-gray-600);">${ch.content||'—'}</td>
                <td style="font-size:11px;">${getCheckMethod(ch)}</td>
                <td style="font-size:11px;color:var(--c-gray-500);">${ch.tool||'-'}</td>
                <td style="font-size:11px;">${ch.standard}</td>
                <td><select class="result-select" id="result-${ch.id}" style="font-size:11px;padding:2px 4px;border-radius:3px;border:1px solid var(--c-gray-200);"><option>待定</option><option>合格</option><option>不合格</option></select></td>
                <td style="text-align:right;padding-right:16px;"><input class="inline-input" style="width:80px;" id="note-${ch.id}" value="${getInstallNote(ch.id)}" placeholder="备注" onchange="App.onInstallNote(this,'${phase.id}','${ch.id}')"></td>
              </tr>
              `;
            }).join('')}
          </tbody>
        </table>
        <div style="margin-top:8px;font-size:12px;color:var(--c-gray-600);">本阶段完成: <strong id="phase-pct-${phase.id}">${calcPhasePct(phase)}</strong></div>
      </div>
    `;
    }).join('');

    // 安全要求清单（固定11项+支持增删，前11条不可删除，仅用户新增项可删除）
    var safetyItems = getSafetyItems();
    var safetyCheckHTML = `
      <div class="card card-foldable"><div class="card-header" onclick="App.toggleCardFold(this)">
        安全要求清单 <input type="checkbox" id="selall-safety" onchange="App.toggleSafetySelectAll(this)" title="全选" style="width:16px;height:16px;cursor:pointer;accent-color:var(--c-primary);margin-left:8px;">
      </div><div class="card-foldable-content">
        <div id="safetyItemList">
          ${safetyItems.map(function(s,i) {
            var isFixed = i < FIXED_SAFETY_COUNT;
            return '<div class="progress-card-item" style="padding:6px 10px;display:flex;align-items:center;">'
              + '<input type="checkbox" class="safety-checkbox" id="safety-' + i + '" style="margin-right:8px;">'
              + '<label for="safety-' + i + '" style="font-size:12px;flex:1;">' + (i+1) + '. ' + s + '</label>'
              + (isFixed ? '<span style="font-size:10px;color:var(--c-gray-400);margin-left:4px;">固定</span>' : '<button class="btn btn-sm btn-outline" onclick="App.removeSafetyItem(' + i + ')" title="删除此项" style="padding:1px 6px;font-size:11px;margin-left:4px;">✕</button>')
              + '</div>';
          }).join('')}
        </div>
        <div style="padding:8px 10px;border-top:1px solid var(--c-gray-100);display:flex;gap:6px;">
          <input type="text" id="newSafetyInput" placeholder="输入新安全要求..." style="flex:1;font-size:12px;padding:4px 8px;border:1px solid var(--c-gray-200);border-radius:4px;">
          <button class="btn btn-sm" onclick="App.addSafetyItem()" style="font-size:12px;padding:4px 10px;">+ 添加</button>
        </div>
      </div></div>
    `;

    const m7eHTML = buildM5ECard(sop.sevenM1E, '现场安装7M1E管控', true);
    // 各子标签差异化风险数据
    var installRiskMap = {
      'ins-1': [
        {level:'high',text:'基础强度不足→回弹检测不合格需返工处理'},
        {level:'high',text:'地脚螺栓偏位→影响设备安装精度'},
        {level:'medium',text:'基坑积水→排水不畅导致工期延误'},
        {level:'low',text:'预埋件锈蚀→防腐涂层破损及时补涂'}
      ],
      'ins-2': [
        {level:'high',text:'吊装作业安全风险→风速>6级禁止吊装，全程监护'},
        {level:'high',text:'吊索具断裂风险→使用前100%检查+5倍安全系数'},
        {level:'medium',text:'舱体落位超差→调整垫铁时防止倾覆'},
        {level:'medium',text:'起重机械故障→备选方案+现场备用吊车'}
      ],
      'ins-3': [
        {level:'high',text:'电气作业安全→严格执行停电、验电、挂接地线'},
        {level:'high',text:'接线错误致短路→相序核对+绝缘复测双确认'},
        {level:'medium',text:'电缆敷设不规范→固定间距/弯曲半径达标'},
        {level:'low',text:'防火封堵遗漏→电缆孔洞100%封堵检查'}
      ],
      'ins-4': [
        {level:'high',text:'管道泄漏→压力试验1.5倍保压30min无渗漏'},
        {level:'medium',text:'保温层脱落→厚度测量+粘接牢固性抽检'},
        {level:'medium',text:'防冻液接触皮肤→配备防护手套+洗眼器'},
        {level:'low',text:'支架松动→手摇测试+紧固力矩标记'}
      ],
      'ins-5': [
        {level:'high',text:'消防联动失效→烟感/温感逐点测试'},
        {level:'high',text:'灭火器配置不足→按规范计算+现场清点'},
        {level:'medium',text:'应急照明不亮→断电测试持续≥90min'},
        {level:'low',text:'动火作业火灾→作业许可+灭火器到位'}
      ],
      'ins-6': [
        {level:'high',text:'接地电阻超标>4Ω→降阻措施或延伸接地网'},
        {level:'high',text:'雷击风险→雷雨天气禁止接地测试'},
        {level:'medium',text:'等电位连接不良→MEB端子排100%检查'},
        {level:'low',text:'接地标识缺失→统一标准接地标识(⏚)'}
      ],
      'ins-7': [
        {level:'medium',text:'围栏高度不足<2.5m→加高至合规'},
        {level:'medium',text:'监控盲区→现场走查全覆盖确认'},
        {level:'low',text:'门禁权限混乱→人员名单与授权一致性核对'},
        {level:'low',text:'录像存储不足<30天→NVR容量扩容'}
      ]
    };
    // 风险卡片占位容器（切换子标签时由refreshInstallRiskCard动态刷新）// 默认展开（添加open类）
    var riskHTML = '<div class="card card-foldable open" id="installRiskCard"><div class="card-header" onclick="App.toggleCardFold(this)">⚠ 风险提示与对策</div><div class="card-foldable-content open"><div style="color:var(--c-gray-400);font-size:12px;padding:8px;">切换子标签查看对应风险</div></div></div>';

    // 资源与效率卡片占位容器（切换子标签时由refreshInstallEfficiencyCard动态刷新）
    var efficiencyHTML = '<div class="card card-foldable open" id="installEfficiencyCard"><div class="card-header" onclick="App.toggleCardFold(this)">📈 资源与效率</div><div class="card-foldable-content open"><div style="color:var(--c-gray-400);font-size:12px;padding:8px;">切换子标签查看对应效率指标</div></div></div>';

    return `
      <div class="sub-tab-nav install-sub-tabs" id="installSubTabs">
        ${subTabs.map(st => `<button class="sub-tab-btn${st.id==='ins-1'?' active':''}" data-tab-group="install" data-subtab="${st.id}">${st.name}</button>`).join('')}
        <label class="install-all-completed-wrap" title="勾选代表所有安装工序全部完工"><input type="checkbox" id="installAllCompleted" onchange="App.toggleInstallAllCompleted(this)"> 安装全部完工</label>
      </div>
      <div style="display:flex;gap:16px;margin-top:12px;align-items:flex-start;">
        <div id="installSubContentArea" style="flex:1;min-width:0;">${subTabContents}</div>
        <div style="flex:0 0 280px;">${riskHTML}${efficiencyHTML}</div>
      </div>
      <div class="tab-grid-3 mt-2">
        ${safetyCheckHTML}
        ${m7eHTML}
        <div class="card card-foldable">
          <div class="card-header" onclick="App.toggleCardFold(this)">📊 现场安装 · 计划 vs 实际进度对比图</div>
          <div class="card-foldable-content" style="padding:10px;">
            <canvas id="installChart"></canvas>
            <div id="installChartAdvice" style="margin-top:8px;font-size:12px;color:#475569;line-height:1.6;"></div>
          </div>
        </div>
      </div>
    `;
  }

  // ========== Tab5 风险联动数据 & 刷新函数 ==========
  var installRiskMap = {
    'ins-1': [
      {level:'high',text:'基础强度不足→回弹检测不合格需返工处理'},
      {level:'high',text:'地脚螺栓偏位→影响设备安装精度'},
      {level:'medium',text:'基坑积水→排水不畅导致工期延误'},
      {level:'low',text:'预埋件锈蚀→防腐涂层破损及时补涂'}
    ],
    'ins-2': [
      {level:'high',text:'吊装作业安全风险→风速>6级禁止吊装，全程监护'},
      {level:'high',text:'吊索具断裂风险→使用前100%检查+5倍安全系数'},
      {level:'medium',text:'舱体落位超差→调整垫铁时防止倾覆'},
      {level:'medium',text:'起重机械故障→备选方案+现场备用吊车'}
    ],
    'ins-3': [
      {level:'high',text:'电气作业安全→严格执行停电、验电、挂接地线'},
      {level:'high',text:'接线错误致短路→相序核对+绝缘复测双确认'},
      {level:'medium',text:'电缆敷设不规范→固定间距/弯曲半径达标'},
      {level:'low',text:'防火封堵遗漏→电缆孔洞100%封堵检查'}
    ],
    'ins-4': [
      {level:'high',text:'管道泄漏→压力试验1.5倍保压30min无渗漏'},
      {level:'medium',text:'保温层脱落→厚度测量+粘接牢固性抽检'},
      {level:'medium',text:'防冻液接触皮肤→配备防护手套+洗眼器'},
      {level:'low',text:'支架松动→手摇测试+紧固力矩标记'}
    ],
    'ins-5': [
      {level:'high',text:'消防联动失效→烟感/温感逐点测试'},
      {level:'high',text:'灭火器配置不足→按规范计算+现场清点'},
      {level:'medium',text:'应急照明不亮→断电测试持续≥90min'},
      {level:'low',text:'动火作业火灾→作业许可+灭火器到位'}
    ],
    'ins-6': [
      {level:'high',text:'接地电阻超标>4Ω→降阻措施或延伸接地网'},
      {level:'high',text:'雷击风险→雷雨天气禁止接地测试'},
      {level:'medium',text:'等电位连接不良→MEB端子排100%检查'},
      {level:'low',text:'接地标识缺失→统一标准接地标识(⏚)'}
    ],
    'ins-7': [
      {level:'medium',text:'围栏高度不足<2.5m→加高至合规'},
      {level:'medium',text:'监控盲区→现场走查全覆盖确认'},
      {level:'low',text:'门禁权限混乱→人员名单与授权一致性核对'},
      {level:'low',text:'录像存储不足<30天→NVR容量扩容'}
    ]
  };

  function refreshInstallRiskCard(subtabId) {
    var container = document.getElementById('installRiskCard');
    if (!container) return;
    var risks = installRiskMap[subtabId] || installRiskMap['ins-1'];
    var content = container.querySelector('.card-foldable-content');
    if (!content) return;
    content.innerHTML = risks.map(function(r) {
      return '<div class="risk-item risk-' + r.level + '"><span class="risk-icon">' + (r.level==='high'?'🔴':r.level==='medium'?'🟡':'🔵') + '</span><span>' + r.text + '</span></div>';
    }).join('');
  }

  // ========== Tab5 资源与效率联动数据 & 刷新函数 ==========
  var installEfficiencyMap = {
    'ins-1': [
      {name:'基础验收一次合格率', value:'92%', target:'≥95%', status:'warn'},
      {name:'预埋件安装精度达标率', value:'88%', target:'≥90%', status:'warn'}
    ],
    'ins-2': [
      {name:'吊装作业一次成功率', value:'95%', target:'≥98%', status:'ok'},
      {name:'吊索具检查覆盖率', value:'100%', target:'100%', status:'ok'},
      {name:'舱体落位精度达标率', value:'90%', target:'≥95%', status:'warn'}
    ],
    'ins-3': [
      {name:'绝缘电阻测试一次合格率', value:'93%', target:'≥95%', status:'warn'},
      {name:'电缆敷设一次验收合格率', value:'91%', target:'≥95%', status:'warn'}
    ],
    'ins-4': [
      {name:'压力试验一次通过率', value:'96%', target:'≥98%', status:'ok'},
      {name:'保温层安装合格率', value:'92%', target:'≥95%', status:'warn'}
    ],
    'ins-5': [
      {name:'消防联动测试一次通过率', value:'88%', target:'≥95%', status:'high'},
      {name:'灭火器配置到位率', value:'95%', target:'100%', status:'warn'}
    ],
    'ins-6': [
      {name:'接地电阻测试一次合格率', value:'90%', target:'≥95%', status:'warn'},
      {name:'接地连接性全格率', value:'93%', target:'≥98%', status:'warn'}
    ],
    'ins-7': [
      {name:'门禁系统调试成功率', value:'94%', target:'≥98%', status:'warn'},
      {name:'录像存储时长达标率', value:'88%', target:'≥95%', status:'warn'}
    ]
  };

  function refreshInstallEfficiencyCard(subtabId) {
    var container = document.getElementById('installEfficiencyCard');
    if (!container) return;
    var effs = installEfficiencyMap[subtabId] || installEfficiencyMap['ins-1'];
    var content = container.querySelector('.card-foldable-content');
    if (!content) return;
    content.innerHTML = '<div style="font-size:11px;">' +
      effs.map(function(e) {
        var statusColor = e.status==='ok'?'#16a34a':(e.status==='warn'?'#d97706':'#dc2626');
        var statusIcon = e.status==='ok'?'✅':(e.status==='warn'?'⚠️':'❌');
        return '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--c-gray-100);">' +
          '<span style="flex:1;">' + e.name + '</span>' +
          '<span style="font-weight:600;color:' + statusColor + ';margin:0 8px;">' + e.value + '</span>' +
          '<span style="font-size:10px;color:var(--c-gray-400);">目标:' + e.target + '</span>' +
          '<span style="margin-left:4px;">' + statusIcon + '</span>' +
          '</div>';
      }).join('') +
      '</div>';
  }

  // ========== Tab 6: 系统调试（完整版·SAT-SOP内置）==========
  function renderCommissionTab() {
    const sop = Store.getSatSOP();
    const phases = sop.phases || [];
    if (!phases || phases.length === 0) {
      return buildThreeColLayout(buildPlaceholderCard('调试SOP数据加载中...'),buildPlaceholderCard(''),buildPlaceholderCard(''));
    }
    const subTabs = phases.map(p => ({ id: 'sat-' + p.sortOrder, name: p.name }));
    
    function getCheckMethod(ch) {
      if (ch.method) return ch.method;
      if (ch.type === '关键') return '仪器测量';
      if (ch.type === '重要') return '目视+量具';
      return '目视';
    }
    
    let subTabContents = phases.map(phase => {
      const itemHeader = phase.sortOrder === 1 ? '检查项目' : '测试项目';
      var allChecks = getMergedChecks('sat', phase);
      return `
      <div class="sub-tab-panel${phase.sortOrder===1?' active':''}" data-panel="sat-${phase.sortOrder}">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;font-size:12px;color:var(--c-gray-600);">
          <div style="display:flex;gap:16px;">
            <span>⏱ 标准工时: ${phase.standardHours}</span>
            <span>${phase.canParallel?'🔄 可并行':'⚠ 不可并行'}</span>
            <span>${itemHeader}: ${allChecks.length}</span>
          </div>
          <button class="btn btn-sm" onclick="App.addCustomCheck('sat','${phase.id}')" style="font-size:12px;padding:4px 10px;">+ 添加检查项</button>
        </div>
        <table class="delivery-table">
          <thead><tr>
            <th style="width:36px;text-align:center;"><input type="checkbox" id="selall-${phase.id}" onchange="App.toggleSATSelectAll(this,'${phase.id}')" title="全选/全不选" style="width:16px;height:16px;cursor:pointer;accent-color:var(--c-primary);"></th>
            <th style="min-width:130px;">${itemHeader}</th>
            <th style="min-width:160px;">测试内容/要求</th>
            <th style="min-width:90px;">检查方法</th>
            <th style="min-width:110px;">验收标准</th>
            <th style="width:70px;">验收结果</th>
            <th style="min-width:70px;">调试工具</th>
            <th style="min-width:70px;">记录输出</th>
            <th style="width:80px;text-align:right;padding-right:16px;">备注</th>
          </tr></thead>
          <tbody>
            ${allChecks.map(ch => {
              var isCustom = ch.id.indexOf('-custom-') >= 0;
              return `
              <tr id="row-${ch.id}">
                <td style="text-align:center;"><input type="checkbox" id="${ch.id}" onchange="App.onSATCheck(this,'${phase.id}','${ch.id}')" ${isSATChecked(ch.id)?'checked':''}></td>
                <td>${ch.item}</td>
                <td style="font-size:11px;color:var(--c-gray-600);">${ch.content||'—'}</td>
                <td style="font-size:11px;">${getCheckMethod(ch)}</td>
                <td style="font-size:11px;">${ch.standard||'-'}</td>
                <td><select class="result-select" id="result-${ch.id}" style="font-size:11px;padding:2px 4px;border-radius:3px;border:1px solid var(--c-gray-200);"><option>待定</option><option>合格</option><option>不合格</option></select></td>
                <td style="font-size:11px;">${ch.tool||'-'}</td>
                <td style="font-size:11px;">${ch.record||'-'}</td>
                <td style="text-align:right;padding-right:16px;"><input class="inline-input" style="width:80px;" id="note-${ch.id}" value="${getSATNote(ch.id)}" placeholder="备注" onchange="App.onSATNote(this,'${phase.id}','${ch.id}')"></td>
              </tr>
              `;
            }).join('')}
          </tbody>
        </table>
        <div style="margin-top:8px;font-size:12px;color:var(--c-gray-600);">本阶段完成: <strong id="phase-pct-${phase.id}">${calcSATPhasePct(phase)}</strong></div>
      </div>
    `}).join('');

    const witnessRoles = [
      '业主代表/监理','研发人员','厂家代表','安装/调试工程师',
      '施工单位','咨询管理公司','专业测试公司','调度/电网公司',
      '其它第三方'
    ];
    const witnessCheckHTML = `
      <div class="card card-foldable"><div class="card-header" onclick="App.toggleCardFold(this)">见证管理清单</div><div class="card-foldable-content">
        ${witnessRoles.map(function(w,i){ return '<div class="progress-card-item" style="padding:6px 10px;">'
          + '<input type="checkbox" id="witness-' + i + '" style="margin-right:8px;">'
          + '<label for="witness-' + i + '" style="font-size:12px;">' + w + '</label>'
          + '</div>'; }).join('')}
      </div></div>
    `;

    // 风险卡片和效率卡片占位容器（切换子标签时由refresh函数动态刷新）// 默认展开
    var riskHTML = '<div class="card card-foldable open" id="commissionRiskCard"><div class="card-header" onclick="App.toggleCardFold(this)">⚠ 风险提示与对策</div><div class="card-foldable-content open"><div style="color:var(--c-gray-400);font-size:12px;padding:8px;">切换子标签查看对应风险</div></div></div>';
    var efficiencyHTML = '<div class="card card-foldable open" id="commissionEfficiencyCard"><div class="card-header" onclick="App.toggleCardFold(this)">📈 资源与效率</div><div class="card-foldable-content open"><div style="color:var(--c-gray-400);font-size:12px;padding:8px;">切换子标签查看对应效率指标</div></div></div>';

    // Tab6底部三卡片（风险卡片用占位容器，由refreshCommissionRiskCard动态刷新）
    return `
      <div class="sub-tab-nav commission-sub-tabs" id="commissionSubTabs">
        ${subTabs.map(st => `<button class="sub-tab-btn${st.id==='sat-1'?' active':''}" data-tab-group="commission" data-subtab="${st.id}">${st.name}</button>`).join('')}
        <label class="sat-all-passed-wrap" title="勾选代表所有调试项目全部合格"><input type="checkbox" id="satAllPassed" onchange="App.toggleSATAllPassed(this)"> 调试全部合格</label>
      </div>
      <div style="display:flex;gap:16px;margin-top:12px;align-items:flex-start;">
        <div id="commissionSubContentArea" style="flex:1;min-width:0;">${subTabContents}</div>
        <div style="flex:0 0 280px;">${riskHTML}${efficiencyHTML}</div>
      </div>
      <div class="tab-grid-3 mt-2">
        ${witnessCheckHTML}
        ${buildM5ECard(sop.sevenM1E,'系统调试7M1E管控',true)}
        <div class="card card-foldable">
          <div class="card-header" onclick="App.toggleCardFold(this)">📊 系统调试 · 计划 vs 实际进度对比图</div>
          <div class="card-foldable-content" style="padding:10px;">
            <canvas id="satChart"></canvas>
            <div id="satChartAdvice" style="margin-top:8px;font-size:12px;color:#475569;line-height:1.6;"></div>
          </div>
        </div>
      </div>
    `;
  }

  // ========== Tab 7: 移交接产（次级标签内容完整化）==========
  function renderHandoverTab() {
    const subTabs = [
      {id:'ho-pre',name:'预验收PAC'},{id:'ho-formal',name:'正式验收FAC'},
      {id:'ho-docs',name:'文件移交'},{id:'ho-spare',name:'备品备件'},{id:'ho-training',name:'客户培训'},{id:'ho-trial',name:'试运行'}
    ];
    return `
      <div class="tab-toolbar-row">
        <div class="sub-tab-nav ho-sub-tabs" id="hoSubTabs">
          ${subTabs.map(st => `<button class="sub-tab-btn${st.id==='ho-pre'?' active':''}" data-tab-group="ho" data-subtab="${st.id}">${st.name}</button>`).join('')}
        </div>
        <div class="tab-toolbar-links">
          <a href="javascript:void(0)" class="btn btn-sm btn-outline training-entry-btn" onclick="App.openTrainingSystem()" title="培训大纲/计划/进度/教材/考试/成绩/建议">🎓 培训管理系统</a>
          <a href="javascript:void(0)" class="btn btn-sm btn-outline" onclick="App.toast('文件管理系统子系统后续开发','info')" title="与文控管理子系统对接">📁 文件管理系统</a>
        </div>
      </div>
      <div id="hoSubContentArea">
        <div class="sub-tab-panel active" data-panel="ho-pre">${renderHoPreContent()}</div>
        <div class="sub-tab-panel" data-panel="ho-formal">${renderHoFormalContent()}</div>
        <div class="sub-tab-panel" data-panel="ho-docs">${renderHoDocsContent()}</div>
        <div class="sub-tab-panel" data-panel="ho-spare">${renderHoSpareContent()}</div>
        <div class="sub-tab-panel" data-panel="ho-training">${renderHoTrainingContent()}</div>
        <div class="sub-tab-panel" data-panel="ho-trial">${renderHoTrialContent()}</div>
      </div>
    `;
  }

  // ========== Tab6 风险联动数据 & 刷新函数 ==========
  var commissionRiskMap = {
    'sat-1': [
      {level:'high',text:'图纸版本不一致→差异项发DCR闭环后再开工'},
      {level:'high',text:'安全交底未签字→禁止进入高压区作业'},
      {level:'medium',text:'LOTO流程未执行→高压操作必须上锁挂牌'},
      {level:'low',text:'合规性风险→当地调试规程需提前备案'}
    ],
    'sat-2': [
      {level:'high',text:'接地电阻>4Ω→排查跨接线断裂/腐蚀点'},
      {level:'high',text:'动力线束虚接→带电操作前必须验电'},
      {level:'medium',text:'消防灭火剂储量不足→补充至≥设计值90%'},
      {level:'low',text:'液冷管路微渗漏→压力测试确认无泄漏'}
    ],
    'sat-3': [
      {level:'high',text:'PACK绝缘<500MΩ→抽检20%全检重点螺栓端子'},
      {level:'high',text:'PCS DC侧绝缘低→检查内部电容残留电荷'},
      {level:'medium',text:'高温高湿环境绝缘偏低→≥0.5MΩ/kV为合格'},
      {level:'low',text:'测试前放电不充分→静置≥15min再测'}
    ],
    'sat-4': [
      {level:'high',text:'CAN总线参数不匹配→500Kbps/CAN2.0B/无校验'},
      {level:'high',text:'涉网定值未备案→需电网调度审批后方可修改'},
      {level:'medium',text:'EMS通信地址冲突→确保所有设备地址唯一'},
      {level:'low',text:'温控阈值与BMS不匹配→统一配置标准'}
    ],
    'sat-5': [
      {level:'high',text:'UPS后备续航不足→电池更换或检修'},
      {level:'medium',text:'消防联动误喷风险→调试期间关闭灭火装置'},
      {level:'medium',text:'动环传感器安装位置偏差→按设计图纸调整'},
      {level:'low',text:'除湿机湿度校准偏移→重新标定传感器'}
    ],
    'sat-6': [
      {level:'high',text:'预充未完成即合闸→严格遵循先低压后高压时序'},
      {level:'high',text:'HVL互锁失效→立即停机排查回路完整性'},
      {level:'high',text:'短路保护拒动→检查熔断器规格和接触器状态'},
      {level:'medium',text:'RCD脱扣异常→复位后确认系统无漏电'}
    ],
    'sat-7': [
      {level:'high',text:'电芯温差>8℃→立即停机检查液冷流量分布'},
      {level:'high',text:'实际容量<95%额定→单体电压一致性深度分析'},
      {level:'medium',text:'往返效率低于设计值→检查PCS变换损耗+BMS自耗'},
      {level:'low',text:'响应时间超限→优化通信链路和指令队列'}
    ],
    'sat-8': [
      {level:'high',text:'孤岛保护失效→测量脱网时间≤规定值(通常2s)'},
      {level:'high',text:'THD谐波>5%→加装滤波器或调整PCS参数'},
      {level:'medium',text:'AGC/AVC响应超时→检查调度接口和网络延迟'},
      {level:'low',text:'消防联动信号丢失→检查硬接线回路'}
    ],
    'sat-9': [
      {level:'high',text:'偏差项未闭环→所有不合格项必须有整改记录'},
      {level:'medium',text:'耐压复测绝缘下降→≥试验前90%为合格'},
      {level:'low',text:'资料归档不全→全套记录可追溯方可签字'}
    ],
    'sat-10': [
      {level:'medium',text:'型式试验报告过期→联系厂家提供最新有效报告'},
      {level:'low',text:'EMC报告缺失→补充EN 61000系列认证文件'}
    ]
  };

  function refreshCommissionRiskCard(subtabId) {
    var container = document.getElementById('commissionRiskCard');
    if (!container) return;
    var risks = commissionRiskMap[subtabId] || commissionRiskMap['sat-1'];
    var content = container.querySelector('.card-foldable-content');
    if (!content) return;
    content.innerHTML = risks.map(function(r) {
      return '<div class="risk-item risk-' + r.level + '"><span class="risk-icon">' + (r.level==='high'?'🔴':r.level==='medium'?'🟡':'🔵') + '</span><span>' + r.text + '</span></div>';
    }).join('');
  }

  // ========== Tab6 资源与效率联动数据 & 刷新函数 ==========
  var commissionEfficiencyMap = {
    'sat-1': [
      {name:'资料审查完成率', value:'—', target:'100%', status:'pending'},
      {name:'安全交底签字率', value:'—', target:'100%', status:'pending'},
      {name:'合规性确认通过率', value:'—', target:'100%', status:'pending'},
      {name:'警示区设置完成率', value:'—', target:'100%', status:'pending'}
    ],
    'sat-2': [
      {name:'外观检查一次合格率', value:'—', target:'≥95%', status:'pending'},
      {name:'线束连接检查通过率', value:'—', target:'100%', status:'pending'},
      {name:'接地电阻合格率', value:'—', target:'100%', status:'pending'},
      {name:'消防系统就绪率', value:'—', target:'100%', status:'pending'}
    ],
    'sat-3': [
      {name:'PACK绝缘一次合格率', value:'—', target:'≥95%', status:'pending'},
      {name:'BANK/DCPM/PCS绝缘合格率', value:'—', target:'≥95%', status:'pending'},
      {name:'测试仪表校准合规率', value:'—', target:'100%', status:'pending'},
      {name:'安全前置条件满足率', value:'—', target:'100%', status:'pending'}
    ],
    'sat-4': [
      {name:'软件升级成功率', value:'—', target:'100%', status:'pending'},
      {name:'参数配置准确率', value:'—', target:'100%（双人复核）', status:'pending'},
      {name:'通信链路建立成功率', value:'—', target:'100%', status:'pending'},
      {name:'涉网定值备案完成率', value:'—', target:'100%', status:'pending'}
    ],
    'sat-5': [
      {name:'UPS带载测试通过率', value:'—', target:'100%', status:'pending'},
      {name:'低压系统调试通过率', value:'—', target:'≥98%', status:'pending'},
      {name:'传感器功能正常率', value:'—', target:'100%', status:'pending'},
      {name:'辅助系统就绪率', value:'—', target:'100%', status:'pending'}
    ],
    'sat-6': [
      {name:'预充回路测试通过率', value:'—', target:'100%', status:'pending'},
      {name:'高压合闸无冲击率', value:'—', target:'100%', status:'pending'},
      {name:'保护功能验证通过率', value:'—', target:'100%', status:'pending'},
      {name:'HVL/IND/短路保护正确率', value:'—', target:'100%', status:'pending'}
    ],
    'sat-7': [
      {name:'小功率试运行通过率', value:'—', target:'100%', status:'pending'},
      {name:'阶梯升功率测试通过率', value:'—', target:'≥95%', status:'pending'},
      {name:'额定功率循环通过率', value:'—', target:'≥95%', status:'pending'},
      {name:'系统往返效率达标率', value:'—', target:'≥设计值', status:'pending'}
    ],
    'sat-8': [
      {name:'孤岛保护测试通过率', value:'—', target:'100%', status:'pending'},
      {name:'谐波THD达标率', value:'—', target:'≤5%', status:'pending'},
      {name:'AGC/AVC响应合格率', value:'—', target:'≥95%', status:'pending'},
      {name:'系统联动测试通过率', value:'—', target:'≥98%', status:'pending'}
    ],
    'sat-9': [
      {name:'SAT验收项目通过率', value:'—', target:'≥95%', status:'pending'},
      {name:'偏差项闭环率', value:'—', target:'100%', status:'pending'},
      {name:'资料归档完整率', value:'—', target:'100%', status:'pending'},
      {name:'见证签字完成率', value:'—', target:'100%', status:'pending'}
    ],
    'sat-10': [
      {name:'型式试验报告核对完成率', value:'—', target:'100%', status:'pending'},
      {name:'报告有效期覆盖率', value:'—', target:'100%', status:'pending'},
      {name:'认证文件齐全率', value:'—', target:'100%', status:'pending'},
      {name:'EMC报告符合率', value:'—', target:'100%', status:'pending'}
    ]
  };

  function refreshCommissionEfficiencyCard(subtabId) {
    var container = document.getElementById('commissionEfficiencyCard');
    if (!container) return;
    var effs = commissionEfficiencyMap[subtabId] || commissionEfficiencyMap['sat-1'];
    var content = container.querySelector('.card-foldable-content');
    if (!content) return;
    content.innerHTML = '<div style="font-size:11px;">' +
      effs.map(function(e) {
        var statusColor = e.status==='ok'?'#16a34a':(e.status==='warn'?'#d97706':'#dc2626');
        var statusIcon = e.status==='ok'?'✅':(e.status==='warn'?'⚠️':'❌');
        return '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--c-gray-100);">' +
          '<span style="flex:1;">' + e.name + '</span>' +
          '<span style="font-weight:600;color:' + statusColor + ';margin:0 8px;">' + e.value + '</span>' +
          '<span style="font-size:10px;color:var(--c-gray-400);">目标:' + e.target + '</span>' +
          '<span style="margin-left:4px;">' + statusIcon + '</span>' +
          '</div>';
      }).join('') +
      '</div>';
  }

  // ========== FAT风险联动数据 & 刷新函数 ==========
  var fatRiskMap = {
    'fat-0': [
      {level:'high',text:'BOM物料不齐套→提前3天追踪缺料到货'},
      {level:'high',text:'保护定值未校核→定值偏差导致保护误动/拒动'},
      {level:'medium',text:'测试设备校准过期→测试结果不具备法律效力'}
    ],
    'fat-1': [
      {level:'medium',text:'涂层厚度不足→盐雾腐蚀风险(海运环境)'},
      {level:'low',text:'铭牌标识遗漏→现场验收不合格返工'}
    ],
    'fat-2': [
      {level:'high',text:'绝缘不达标→现场安装后无法通过SAT复测'},
      {level:'high',text:'环境湿度影响读数→记录温湿度必要时修正'},
      {level:'medium',text:'耐压前未复测绝缘→击穿损坏设备'}
    ],
    'fat-3': [
      {level:'high',text:'耐压击穿→设备报废需重新生产'},
      {level:'high',text:'泄漏电流超标→绝缘系统存在隐患'},
      {level:'medium',text:'耐压后绝缘下降≥10%→排查受潮点'}
    ],
    'fat-4': [
      {level:'high',text:'BMS采集超差→SOC/SOH估算失准影响运行策略'},
      {level:'high',text:'保护功能拒动→电池热失控风险'},
      {level:'medium',text:'CAN通信异常→BMS-PCS协调失效'}
    ],
    'fat-5': [
      {level:'high',text:'液冷泄漏→电气短路火灾风险'},
      {level:'medium',text:'流量不足→电芯温差>5℃加速衰减'},
      {level:'low',text:'温控精度差→影响充放电效率'}
    ],
    'fat-6': [
      {level:'high',text:'消防联动失败→火灾时无法自动灭火'},
      {level:'medium',text:'探测器灵敏度不达标→延迟报警'},
      {level:'low',text:'灭火剂储量不足→灭火能力下降'}
    ],
    'fat-7': [
      {level:'high',text:'Modbus通信不通→EMS无法监控系统状态'},
      {level:'medium',text:'IO信号错位→控制逻辑紊乱'},
      {level:'low',text:'网线质量差→通信丢包频繁'}
    ],
    'fat-8': [
      {level:'high',text:'充放电效率<88%→能量损失过大'},
      {level:'high',text:'热分布不均→局部热点加速老化'},
      {level:'medium',text:'保护联调拒动→充放电过程无安全屏障'}
    ],
    'fat-9': [
      {level:'high',text:'固定不牢→海运颠簸造成内部损伤'},
      {level:'medium',text:'干燥剂不足→海上高湿导致凝露锈蚀'},
      {level:'low',text:'附件遗漏→现场安装缺少备件工具'}
    ]
  };

  // ========== Tab3 生产制造 - 全子标签风险数据映射 ==========
  var mfgRiskMap = {
    'mfg-order': [
      {level:'high',text:'EPC合同转化延迟→影响排产启动时间'},
      {level:'high',text:'BOM物料不齐套→生产无法按计划开工'},
      {level:'medium',text:'产能评估不足→交期可能延期'},
      {level:'medium',text:'长周期物料(314Ah电芯)到货风险→需提前2周追踪'},
      {level:'low',text:'排产计划与实际产能偏差→动态调整'}
    ],
    'mfg-iqc': [
      {level:'high',text:'电芯容量/内阻超差→模组一致性下降'},
      {level:'high',text:'BMS/PCS来料功能异常→整机调试受阻'},
      {level:'medium',text:'液冷组件密封性不良→运行泄漏隐患'},
      {level:'medium',text:'消防组件3C认证缺失→验收不合格'},
      {level:'low',text:'线缆/端子规格不符→返工更换'}
    ],
    'mfg-assemble': [
      {level:'high',text:'电芯模组焊接虚焊→热失控风险'},
      {level:'high',text:'高压绝缘距离不足→耐压测试不通过'},
      {level:'medium',text:'BMS采集线束接错→SOC估算失准'},
      {level:'medium',text:'液冷管路连接渗漏→系统效率下降'},
      {level:'low',text:'装配扭矩不达标→振动松脱'}
    ],
    'mfg-qc': [
      {level:'high',text:'IPQC漏检不良品流入下道工序'},
      {level:'high',text:'FQC功能测试覆盖率不足→现场故障'},
      {level:'medium',text:'过程能力指数(Cpk)<1.33→制程不稳定'},
      {level:'medium',text:'环境温湿度未监控→测量数据偏差'},
      {level:'low',text:'检测设备校准过期→数据不可追溯'}
    ],
    'mfg-pack': [
      {level:'high',text:'固定件松动→海运颠簸内部损伤'},
      {level:'high',text:'干燥剂/防潮措施不足→海上凝露锈蚀'},
      {level:'medium',text:'装箱清单与实物不符→现场缺件'},
      {level:'medium',text:'防护包装厚度不够→运输损坏'},
      {level:'low',text:'随机文件/备件遗漏→安装延误'}
    ]
  };

  function refreshMfgRiskCard(subtabId) {
    var riskContent = document.getElementById('mfgRiskCardContent');
    if (!riskContent) return;
    // FAT标签使用fatRiskMap（更细粒度），其他使用mfgRiskMap
    var risks = [];
    if (subtabId && subtabId.indexOf('fat-') === 0) {
      risks = fatRiskMap[subtabId] || [];
    } else {
      risks = mfgRiskMap[subtabId] || mfgRiskMap['mfg-order'] || [];
    }
    if (risks.length === 0) {
      riskContent.innerHTML = '<div style="color:var(--c-gray-400);font-size:12px;padding:8px;">暂无特定风险项</div>';
      return;
    }
    riskContent.innerHTML = risks.map(function(r) {
      return '<div class="risk-item risk-' + r.level + '"><span class="risk-icon">' + (r.level==='high'?'🔴':r.level==='medium'?'🟡':'🔵') + '</span><span>' + r.text + '</span></div>';
    }).join('');
  }

  function switchFatPhase(btn) {
    var phaseId = btn.getAttribute('data-fat-phase');
    // 更新标签active状态
    document.querySelectorAll('#fatSubTabs .fat-phase-btn').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
    // 获取phase数据并渲染表格
    var fatSOP = Store.getFatSOP();
    var phase = (fatSOP.phases||[]).find(function(p) { return p.id === phaseId; });
    if (!phase) return;
    var tableHTML = buildFatPhaseTable(phase);
    var tableArea = document.getElementById('fatTableArea');
    if (tableArea) tableArea.innerHTML = tableHTML;
    // 刷新风险卡片
    var riskContent = document.getElementById('mfgRiskCardContent');
    if (riskContent) {
      var risks = fatRiskMap[phaseId] || [];
      riskContent.innerHTML = risks.map(function(r) {
        return '<div class="risk-item risk-' + r.level + '"><span class="risk-icon">' + (r.level==='high'?'🔴':r.level==='medium'?'🟡':'🔵') + '</span><span>' + r.text + '</span></div>';
      }).join('');
    }
    // 恢复FAT全部合格状态
    initFATAllPassedState();
  }

  function toggleFATSelectAll(masterCb, phaseId) {
    var checked = masterCb.checked;
    var table = masterCb.closest('.card-body');
    if (!table) return;
    table.querySelectorAll('tbody input[type="checkbox"]').forEach(function(cb) { cb.checked = checked; });
    if (typeof updateMFGOverallProgress === 'function') updateMFGOverallProgress();
  }

  // ★ FAT全部合格：一键勾选/取消所有phase的所有检查项
  // ========== R&D 检查项管理（新品研发标签页）==========
  // ★ R&D 全选/全不选：必须持久化到Store，否则calcRndPhaseProgress从Store读不到状态
  function toggleRDSelectAll(masterCb, phaseId) {
    var checked = masterCb.checked;
    var table = masterCb.closest('.card-body');
    if (!table) return;
    // 1. 设置DOM checkbox状态
    table.querySelectorAll('tbody input[type="checkbox"]').forEach(function(cb) { cb.checked = checked; });
    // 2. ★ 关键修复：将每个检查项的状态持久化到Store
    var rdSOP = Store.getRdSOP();
    var phase = (rdSOP.phases||[]).find(function(p) { return p.id === phaseId; });
    if (phase) {
      var allChecks = getMergedChecks('rd', phase);
      allChecks.forEach(function(ch) {
        Store.setSOPCheckState(null, 'rd', ch.id, checked);
      });
    }
    // 3. 更新阶段完成百分比和总进度
    updateRndPhasePct(phaseId);
  }

  function onRDCheck(cb) {
    var checkId = cb.id;
    var phaseId = checkId.split('-').slice(0, 2).join('-'); // 'rd-1' from 'rd-1-1'
    // 直接传布尔值到Store
    Store.setSOPCheckState(null, 'rd', checkId, cb.checked);
    // 更新阶段完成百分比
    updateRndPhasePct(phaseId);
  }

  function initRDCheckState(phaseId) {
    var rdSOP = Store.getRdSOP();
    var phase = (rdSOP.phases||[]).find(function(p) { return p.id === phaseId; });
    if (!phase) return;
    (phase.checks||[]).forEach(function(ch) {
      var el = document.getElementById(ch.id);
      if (!el) return;
      var state = Store.getSOPCheckState(null, 'rd', ch.id);
      if (state && state.passed) el.checked = true;
      // 恢复备注
      var noteEl = document.getElementById('note-' + ch.id);
      if (noteEl && state && state.notes) noteEl.value = state.notes;
      // 恢复验收结果
      var resultEl = document.getElementById('result-' + ch.id);
      if (resultEl && state && state.result) resultEl.value = state.result;
    });
    updateRndPhasePct(phaseId);
  }

  // ========== R&D 进度计算（均匀分配法）==========
  // 计算某阶段完成度（0~100）
  function calcRndPhaseProgress(phaseId) {
    var rdSOP = Store.getRdSOP();
    var phase = (rdSOP.phases||[]).find(function(p) { return p.id === phaseId; });
    if (!phase) return 0;
    var allChecks = getMergedChecks('rd', phase);
    if (!allChecks.length) return 0;
    var checked = 0;
    allChecks.forEach(function(ch) {
      // ★ 从Store持久化数据读取状态（非DOM），解决切换标签后前一阶段checkbox不在DOM导致进度归零的BUG
      var state = Store.getSOPCheckState(null, 'rd', ch.id);
      if (state && state.passed) checked++;
    });
    return Math.round(checked / allChecks.length * 100);
  }

  // 计算R&D总进度（8阶段均匀分配，每阶段12.5%）
  function calcRndTotalProgress() {
    var rdSOP = Store.getRdSOP();
    var phases = rdSOP.phases || [];
    if (!phases.length) return 0;
    var PHASE_COUNT = phases.length;
    var WEIGHT_PER_PHASE = 100 / PHASE_COUNT;
    var totalWeight = 0;
    phases.forEach(function(p) {
      totalWeight += calcRndPhaseProgress(p.id) / 100 * WEIGHT_PER_PHASE;
    });
    return Math.round(totalWeight);
  }

  function updateRndPhasePct(phaseId) {
    var pct = calcRndPhaseProgress(phaseId);
    var pctEl = document.getElementById('phase-pct-' + phaseId);
    if (pctEl) pctEl.textContent = pct + '%';
    updateRndOverallProgress();
  }

  function updateRndOverallProgress() {
    var pct = calcRndTotalProgress();
    Store.setPhaseProgress(null, '1_rnd', pct);
    if (typeof renderProgressAxis === 'function') renderProgressAxis();
  }

  function toggleFATAllPassed(cb) {
    var checked = cb.checked;
    // 持久化状态
    localStorage.setItem('ess_fat_all_passed', checked ? '1' : '0');
    // 勾选当前DOM中所有FAT检查项checkbox
    document.querySelectorAll('#fatTableArea tbody input[type="checkbox"]').forEach(function(c) { c.checked = checked; });
    // 同步更新所有phase的完成百分比显示
    var fatSOP = Store.getFatSOP();
    (fatSOP.phases||[]).forEach(function(p) {
      var el = document.getElementById('phase-pct-' + p.id);
      if (el) el.textContent = checked ? '100%' : '0%';
    });
    // 更新生产制造整体进度
    if (typeof updateMFGOverallProgress === 'function') updateMFGOverallProgress();
    // 提示用户
    if (checked) toast('已标记FAT全部合格，所有测试项自动打勾 ✓', 'success');
  }

  // ★ 初始化FAT全部合格状态（页面加载/切换时调用）
  function initFATAllPassedState() {
    var saved = localStorage.getItem('ess_fat_all_passed') === '1';
    var cb = document.getElementById('fatAllPassed');
    if (cb) cb.checked = saved;
    if (saved) {
      document.querySelectorAll('#fatTableArea tbody input[type="checkbox"]').forEach(function(c) { c.checked = true; });
      var fatSOP = Store.getFatSOP();
      (fatSOP.phases||[]).forEach(function(p) {
        var el = document.getElementById('phase-pct-' + p.id);
        if (el) el.textContent = '100%';
      });
    }
  }

  // ========== 安装全部完工（一键勾选所有安装检查项）==========
  function toggleInstallAllCompleted(cb) {
    var checked = cb.checked;
    localStorage.setItem('ess_install_all_completed', checked ? '1' : '0');
    // 持久化到Store（传布尔值，不是对象！）
    var installSOP = Store.getInstallSOP();
    (installSOP.phases||[]).forEach(function(p) {
      var allChecks = getMergedChecks('install', p);
      allChecks.forEach(function(ch) {
        Store.setSOPCheckState(null, 'install', ch.id, checked);
      });
      // 更新阶段百分比显示
      var el = document.getElementById('phase-pct-' + p.id);
      if (el) el.textContent = checked ? '100%' : '0%';
    });
    // 勾选/取消DOM中当前可见的安装checkbox
    document.querySelectorAll('#installSubContentArea input[type="checkbox"]').forEach(function(c) { c.checked = checked; });
    // 更新5.现场安装进度
    if (checked) {
      Store.setPhaseProgress(null, '5_install', 100);
    } else {
      Store.setPhaseProgress(null, '5_install', 0);
    }
    if (typeof renderProgressAxis === 'function') renderProgressAxis();
    if (checked) toast('已标记安装全部完工，所有检查项自动打勾 ✓', 'success');
  }

  function initInstallAllCompletedState() {
    var saved = localStorage.getItem('ess_install_all_completed') === '1';
    var cb = document.getElementById('installAllCompleted');
    if (cb) cb.checked = saved;
    if (saved) {
      document.querySelectorAll('#installSubContentArea input[type="checkbox"]').forEach(function(c) { c.checked = true; });
      var installSOP = Store.getInstallSOP();
      (installSOP.phases||[]).forEach(function(p) {
        var el = document.getElementById('phase-pct-' + p.id);
        if (el) el.textContent = '100%';
      });
    }
  }

  // ========== 调试全部合格（一键勾选所有调试检查项）==========
  function toggleSATAllPassed(cb) {
    var checked = cb.checked;
    localStorage.setItem('ess_sat_all_passed', checked ? '1' : '0');
    // 持久化到Store（传布尔值，不是对象！）
    var satSOP = Store.getSatSOP();
    (satSOP.phases||[]).forEach(function(p) {
      var allChecks = getMergedChecks('sat', p);
      allChecks.forEach(function(ch) {
        Store.setSOPCheckState(null, 'sat', ch.id, checked);
      });
      // 更新阶段百分比显示
      var el = document.getElementById('phase-pct-' + p.id);
      if (el) el.textContent = checked ? '100%' : '0%';
    });
    // 勾选/取消DOM中当前可见的调试checkbox
    document.querySelectorAll('#commissionSubContentArea input[type="checkbox"]').forEach(function(c) { c.checked = checked; });
    // 更新6.系统调试进度
    if (checked) {
      Store.setPhaseProgress(null, '6_commission', 100);
    } else {
      Store.setPhaseProgress(null, '6_commission', 0);
    }
    if (typeof renderProgressAxis === 'function') renderProgressAxis();
    if (checked) toast('已标记调试全部合格，所有测试项自动打勾 ✓', 'success');
  }

  function initSATAllPassedState() {
    var saved = localStorage.getItem('ess_sat_all_passed') === '1';
    var cb = document.getElementById('satAllPassed');
    if (cb) cb.checked = saved;
    if (saved) {
      document.querySelectorAll('#commissionSubContentArea input[type="checkbox"]').forEach(function(c) { c.checked = true; });
      var satSOP = Store.getSatSOP();
      (satSOP.phases||[]).forEach(function(p) {
        var el = document.getElementById('phase-pct-' + p.id);
        if (el) el.textContent = '100%';
      });
    }
  }

  // ★ 生产制造"订单全部完成"功能
  function toggleMfgAllCompleted(cb) {
    var checked = cb.checked;
    localStorage.setItem('ess_mfg_all_completed', checked ? '1' : '0');

    // 生产制造页包含多种类型的checkbox，必须覆盖所有6个子标签：
    // 1. 订单转化: mfg-ord-mo1~mo5 (buildProgressCard)
    // 2. 来料IQC: iqc-iqc1~iqc5 (自定义表格)
    // 3. 生产装配: mfg-asm-ma1~ma8 (buildProgressCard)
    // 4. 质量QC: qc-qc1~qc7 (自定义表格)
    // 5. FAT工厂验收: fat阶段checks (SOP结构)
    // 6. 包装发货: mfg-pk-mp1~mp5 (buildProgressCard)
    var allMfgPrefixes = [
      'mfg-ord-', 'mfg-asm-', 'mfg-pk-',   // buildProgressCard生成的标准ID
      'fat-',                               // FAT SOP检查项ID前缀
      'iqc-',                               // IQC自定义表格checkbox ID
      'qc-'                                 // QC自定义表格checkbox ID
    ];

    // 遍历所有前缀，勾选/取消对应checkbox
    allMfgPrefixes.forEach(function(prefix) {
      document.querySelectorAll('[id^="' + prefix + '"]').forEach(function(c) {
        if (c.type !== 'checkbox') return;
        if (c.id && c.id.indexOf('selall-') === 0) return; // 排除全选主checkbox
        c.checked = checked;
        // 切换completed样式（进度卡片项的样式）
        var pci = document.getElementById('pci-' + c.id);
        if (pci) pci.classList.toggle('completed', checked);
      });
    });

    // 同时处理FAT SOP检查项（通过Store持久化）
    var fatSOP = Store.getFatSOP();
    if (fatSOP && fatSOP.phases) {
      fatSOP.phases.forEach(function(p) {
        (p.checks || []).forEach(function(ch) {
          Store.setSOPCheckState(null, 'fat', ch.id, checked);
        });
      });
    }

    // 更新3.生产制造阶段进度（直接设置100%或0%，不依赖updateMFGOverallProgress的计算）
    if (checked) {
      Store.setPhaseProgress(null, '3_mfg', 100);
      toast('已标记订单全部完成，所有检查项自动打勾 ✓', 'success');
    } else {
      Store.setPhaseProgress(null, '3_mfg', 0);
    }

    // 更新L2进度轴
    if (typeof renderProgressAxis === 'function') renderProgressAxis();
  }

  // ★ 初始化生产制造"订单全部完成"状态
  function initMfgAllCompletedState() {
    var saved = localStorage.getItem('ess_mfg_all_completed') === '1';
    var cb = document.getElementById('mfgAllCompleted');
    if (cb) cb.checked = saved;

    if (saved) {
      // 如果已勾选，确保进度显示100%并勾选所有checkbox
      Store.setPhaseProgress(null, '3_mfg', 100);
      // 覆盖所有子标签的checkbox
      var allMfgPrefixes = ['mfg-ord-','mfg-asm-','mfg-pk-','fat-','iqc-','qc-'];
      allMfgPrefixes.forEach(function(prefix) {
        document.querySelectorAll('[id^="' + prefix + '"]').forEach(function(c) {
          if (c.type !== 'checkbox') return;
          if (c.id && c.id.indexOf('selall-') === 0) return;
          c.checked = true;
        });
      });
    }
    // 注意：取消时不重置checkbox，让用户手动操作或重新触发toggleMfgAllCompleted
  }
  function getCustomChecks(sopType, phaseId) {
    var key = 'ess_custom_' + sopType + '_' + phaseId;
    try { return JSON.parse(localStorage.getItem(key)) || []; } catch(e) { return []; }
  }
  function saveCustomChecks(sopType, phaseId, checks) {
    var key = 'ess_custom_' + sopType + '_' + phaseId;
    localStorage.setItem(key, JSON.stringify(checks));
  }
  function addCustomCheck(sopType, phaseId) {
    // 简单弹窗输入检查项名称，其他字段用默认值
    var itemName = prompt('请输入新增检查项目名称：');
    if (!itemName) return;
    var content = prompt('请输入检查内容/要求（可选）：') || '';
    var standard = prompt('请输入验收标准（可选）：') || '-';
    var refStd = prompt('请输入参考标准编号（如GB/T 36276-2018，可选）：') || '-';
    var type = confirm('是否为关键项？点击确定为关键，取消为重要') ? '关键' : '重要';
    var tool = prompt('请输入检查工具（可选）：') || '-';
    var record = prompt('请输入记录输出（可选）：') || '-';
    var checks = getCustomChecks(sopType, phaseId);
    var checkData = {
      id: phaseId + '-custom-' + Date.now(),
      item: itemName,
      content: content,
      standard: standard,
      refStd: refStd,
      type: type,
      tool: tool,
      record: record
    };
    checks.push(checkData);
    saveCustomChecks(sopType, phaseId, checks);
    toast('已添加检查项，刷新后生效','success');
    // 刷新当前Tab
    switchTab(currentTab);
  }
  function removeCustomCheck(sopType, phaseId, checkId) {
    var checks = getCustomChecks(sopType, phaseId);
    checks = checks.filter(function(c) { return c.id !== checkId; });
    saveCustomChecks(sopType, phaseId, checks);
    toast('已删除检查项','info');
    switchTab(currentTab);
  }
  function getMergedChecks(sopType, phase) {
    // 合并内置检查项和自定义检查项
    var customChecks = getCustomChecks(sopType, phase.id);
    return phase.checks.concat(customChecks);
  }

  function renderHoPreContent() {
    return buildThreeColLayout(
      buildProgressCard('ho-pre','PAC预验收进度',[{id:'hp1',name:'现场工程检查'},{id:'hp2',name:'设备功能验证'},{id:'hp3',name:'资料完整性检查'},{id:'hp4',name:'遗留项清单'},{id:'hp5',name:'PAC签字确认'}]),
      buildDeliveryTableCard('PAC交付协同',[
        {item:'工程完工报告(MCD)签署',owner:'项目经理',deadline:'PAC前',status:'pending'},
        {item:'设备开箱验收单签署',owner:'交付',deadline:'PAC前',status:'pending'},
        {item:'遗留项清单双方确认',owner:'交付经理',deadline:'PAC前',status:'warn'}]),
      buildRiskCard('7_ho_pre',[{level:'medium',text:'遗留项过多→录入遗留项清单+处理时间表'}])
    );
  }
  function renderHoFormalContent() {
    return buildThreeColLayout(
      buildProgressCard('ho-fac','FAC正式验收进度',[{id:'hf1',name:'遗留项整改完成'},{id:'hf2',name:'消防联动测试通过'},{id:'hf3',name:'并网性能测试通过'},{id:'hf4',name:'FAC验收报告签署'},{id:'hf5',name:'质保期起算确认'}]),
      buildDeliveryTableCard('FAC交付协同',[
        {item:'FAC验收报告(三方签署)',owner:'项目经理',deadline:'FAC当天',status:'pending'},
        {item:'质保起始日期确认',owner:'商务',deadline:'FAC签署时',status:'warn'},
        {item:'所有遗留项闭环',owner:'交付经理',deadline:'FAC前',status:'pending'}]),
      buildRiskCard('7_ho_formal',[{level:'high',text:'消防联动不达标→重新测试+整改'}])
    );
  }
  function renderHoDocsContent() {
    return buildThreeColLayout(
      buildProgressCard('ho-docs','文件移交清单',[{id:'hd1',name:'设备出厂评书及合格证'},{id:'hd2',name:'客户手册(A03+A04)'},{id:'hd3',name:'电气图纸+BOM清单'},
        {id:'hd4',name:'调试测试报告(FAT/SAT/涉网)'},{id:'hd5',name:'隐蔽工程验收记录'},{id:'hd6',name:'应急预案+操作规程'}]),
      buildDeliveryTableCard('文件移交管理',[
        {item:'文件清单三方签字',owner:'文档工程师',deadline:'移交时',status:'pending'},
        {item:'电子版(U盘)交付',owner:'文档',deadline:'移交时',status:'pending'},
        {item:'版权声明(图纸知识产权)',owner:'法务',deadline:'移交时',status:'pending'}]),
      buildRiskCard('7_ho_docs',[{level:'medium',text:'文件不全→按交付文件清单逐项核对'}])
    );
  }
  function renderHoSpareContent() {
    return buildThreeColLayout(
      buildProgressCard('ho-sp','备品备件移交',[{id:'hs1',name:'备件清单核对'},{id:'hs2',name:'备件实物清点'},{id:'hs3',name:'备件入库签字'},{id:'hs4',name:'备件保养期说明'},{id:'hs5',name:'更换政策确认'}]),
      buildDeliveryTableCard('备件移交管理',[
        {item:'备件V3清单(按柜型)',owner:'仓库',deadline:'移交时',status:'pending'},
        {item:'易损考件移交',owner:'仓库',deadline:'移交时',status:'pending'},
        {item:'专用工具/测试仪移交',owner:'调试',deadline:'移交时',status:'pending'}]),
      buildRiskCard('7_ho_spare',[
        {level:'high',text:'备件清单不符→V3清单三方逐项核对'},
        {level:'medium',text:'易损件缺货→提前2周采购+最低库存预警'},
        {level:'medium',text:'专用工具遗漏→按移交清单逐一清点'},
        {level:'low',text:'备件存储条件不当→防潮/防尘/温度要求'}
      ])
    );
  }
  function renderHoTrainingContent() {
    return buildThreeColLayout(
      buildProgressCard('ho-train','客户培训进度',[{id:'ht1',name:'系统操作培训(一般操作)'},{id:'ht2',name:'常见报警处理培训'},{id:'ht3',name:'应急处理流程培训'},{id:'ht4',name:'培训考核'},{id:'ht5',name:'培训评价+证书发放'}]),
      buildDeliveryTableCard('培训管理',[
        {item:'培训课件/教材准备',owner:'培训工程师',deadline:'商运前7天',status:'pending'},
        {item:'培训场所/设备调试好',owner:'交付',deadline:'培训前',status:'pending'},
        {item:'培训签到+考核成绩',owner:'培训',deadline:'培训当天',status:'pending'}]),
      buildRiskCard('7_ho_training',[
        {level:'high',text:'培训效果不达标→考核<80分需重新培训'},
        {level:'medium',text:'关键操作人员缺席→补训+签到记录'},
        {level:'medium',text:'教材/课件不完整→提前7天准备并审阅'},
        {level:'low',text:'培训场所未就绪→设备调试+环境检查'}
      ])
    );
  }
  function renderHoTrialContent() {
    return buildThreeColLayout(
      buildProgressCard('ho-trial','试运行进度',[{id:'ht1',name:'试运行启动准备'},{id:'ht2',name:'负载试运行(20%~80%SOC)'},{id:'ht3',name:'满充放试运行(7天连续)'},{id:'ht4',name:'充放试运行(7天连续)'},{id:'ht5',name:'试运行报告签署+商运启动'}]),
      buildDeliveryTableCard('试运行管理',[
        {item:'试运行日报(×7天)',owner:'调试',deadline:'每日上午',status:'pending'},
        {item:'试运行故障待办清单',owner:'调试',deadline:'发现即处理',status:'warn'},
        {item:'商运启动确认',owner:'项目经理',deadline:'7天试运行通过',status:'pending'}]),
      buildRiskCard('7_ho_trial',[{level:'high',text:'试运行中断→立即停机+分析+通知'}])
    );
  }

  // ========== 培训管理系统专栏 ==========
  var _trExamCache = null;
  function trEsc(s){ return String(s==null?'':s).replace(/[&<>"]/g, function(m){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]; }); }
  function methodLabel(m){ return m==='theory'?'理论':(m==='hands-on'?'实操':'案例'); }
  function statusLabel(s){ return s==='done'?'已完成':(s==='ongoing'?'实施中':'待实施'); }
  function typeLabel(t){ return t==='ppt'?'PPT':(t==='xls'?'EXCEL':'WORD'); }
  function fbTypeLabel(t){ return t==='content'?'培训内容':(t==='form'?'培训形式':(t==='trainer'?'讲师':'其他')); }
  function diffLabel(d){ return d==='easy'?'容易':(d==='medium'?'中等':'困难'); }
  function courseNameOf(cid){ var o=Store.getTraining().outline.find(function(c){return c.id===cid;}); return o?o.name:cid; }
  function todayStr(){ return new Date().toISOString().slice(0,10); }
  function nowTime(){ var d=new Date(); return ('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2); }
  function statCard(label,val){ return '<div class="tr-stat-card"><div class="tr-stat-val">'+val+'</div><div class="tr-stat-label">'+label+'</div></div>'; }

  function openTrainingSystem() {
    var existing = document.getElementById('trainingOverlay');
    if (existing) { existing.remove(); return; }
    var overlay = document.createElement('div');
    overlay.id = 'trainingOverlay';
    overlay.className = 'training-overlay';
    overlay.innerHTML = '<div class="training-overlay-inner">'
      + '<div class="training-overlay-head"><h3>🎓 培训管理系统</h3><button class="btn btn-xs btn-outline" onclick="App.closeTrainingOverlay()">✕ 关闭</button></div>'
      + renderTrainingSystem()
      + '</div>';
    document.body.appendChild(overlay);
  }
  function closeTrainingOverlay() {
    var el = document.getElementById('trainingOverlay');
    if (el) el.remove();
  }
  function renderTrainingSystem() {
    return '<div class="training-system">'
      + '<div class="training-nav">'
      +   '<button class="tr-nav-btn active" data-tr-mod="outline" onclick="App.showTrainingModule(\'outline\')">培训大纲</button>'
      +   '<button class="tr-nav-btn" data-tr-mod="plan" onclick="App.showTrainingModule(\'plan\')">培训计划</button>'
      +   '<button class="tr-nav-btn" data-tr-mod="progress" onclick="App.showTrainingModule(\'progress\')">培训进度</button>'
      +   '<button class="tr-nav-btn" data-tr-mod="materials" onclick="App.showTrainingModule(\'materials\')">培训教材</button>'
      +   '<button class="tr-nav-btn" data-tr-mod="exam" onclick="App.showTrainingModule(\'exam\')">培训考试</button>'
      +   '<button class="tr-nav-btn" data-tr-mod="scoreStat" onclick="App.showTrainingModule(\'scoreStat\')">成绩统计</button>'
      +   '<button class="tr-nav-btn" data-tr-mod="scoreQuery" onclick="App.showTrainingModule(\'scoreQuery\')">成绩查询</button>'
      +   '<button class="tr-nav-btn" data-tr-mod="feedback" onclick="App.showTrainingModule(\'feedback\')">培训建议</button>'
      + '</div>'
      + '<div class="training-module-area" id="trainingModuleArea">' + renderTrainingModule('outline') + '</div>'
      + '</div>';
  }
  function showTrainingModule(mod) {
    document.querySelectorAll('.tr-nav-btn').forEach(function(b){ b.classList.toggle('active', b.dataset.trMod === mod); });
    var area = document.getElementById('trainingModuleArea');
    if (area) area.innerHTML = renderTrainingModule(mod);
  }
  function renderTrainingModule(mod) {
    if (mod==='plan') return renderTrainingPlan();
    if (mod==='progress') return renderTrainingProgress();
    if (mod==='materials') return renderTrainingMaterials();
    if (mod==='exam') return renderTrainingExam();
    if (mod==='scoreStat') return renderTrainingScoreStat();
    if (mod==='scoreQuery') return renderTrainingScoreQuery();
    if (mod==='feedback') return renderTrainingFeedback();
    return renderTrainingOutline();
  }
  function renderTrainingOutline() {
    var t = Store.getTraining();
    var internal = t.outline.filter(function(c){return c.category==='internal';});
    var customer = t.outline.filter(function(c){return c.category==='customer';});
    function card(c){
      return '<div class="tr-course-card">'
        + '<div class="tr-course-head"><span class="tr-course-name">'+trEsc(c.name)+'</span>'
        + '<span class="tr-badge tr-method-'+c.method+'">'+methodLabel(c.method)+'</span>'
        + '<span class="tr-course-dur">'+c.durationH+'h</span></div>'
        + '<div class="tr-course-obj">目标：'+trEsc(c.objective)+'</div>'
        + '<div class="tr-course-target">对象：'+trEsc(c.target)+'</div>'
        + '<ul class="tr-course-content">'+c.content.map(function(x){return '<li>'+trEsc(x)+'</li>';}).join('')+'</ul>'
        + '</div>';
    }
    return '<div class="tr-section">'
      + '<h4 class="tr-section-title">对内培训（基础知识 / 技能培训）</h4><div class="tr-course-grid">'+internal.map(card).join('')+'</div>'
      + '<h4 class="tr-section-title">对客户培训（操作 / 运维技能培训）</h4><div class="tr-course-grid">'+customer.map(card).join('')+'</div>'
      + '</div>';
  }
  function renderTrainingPlan() {
    var t = Store.getTraining();
    var courses = {}; t.outline.forEach(function(c){courses[c.id]=c.name;});
    var rows = t.plans.map(function(p){
      var cn = p.courseIds.map(function(id){return courses[id]||id;}).join('、');
      return '<tr><td>'+trEsc(p.title)+'</td><td>'+trEsc(p.date)+'</td><td>'+trEsc(p.location)+'</td>'
        + '<td>'+trEsc(p.trainer)+'</td><td>'+trEsc(p.audience)+'</td><td>'+trEsc(cn)+'</td>'
        + '<td><span class="tr-status tr-status-'+p.status+'">'+statusLabel(p.status)+'</span></td>'
        + '<td><button class="btn btn-xs btn-danger" onclick="App.delTrainingPlan(\''+p.id+'\')">删除</button></td></tr>';
    }).join('');
    return '<div class="tr-section"><div class="tr-toolbar"><button class="btn btn-sm btn-primary" onclick="App.addTrainingPlan()">+ 新增培训计划</button></div>'
      + '<table class="tr-table"><thead><tr><th>计划名称</th><th>日期</th><th>地点</th><th>讲师</th><th>受众</th><th>课程</th><th>状态</th><th>操作</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
  }
  function addTrainingPlan() {
    var t = Store.getTraining();
    var courseOpts = t.outline.map(function(c){return '<option value="'+c.id+'">'+trEsc(c.name)+'</option>';}).join('');
    var body = '<div class="tr-form-grid">'
      + '<label>计划名称<input id="plTitle" class="tr-input" placeholder="如：XX项目客户运维培训"></label>'
      + '<label>日期<input id="plDate" class="tr-input" type="date"></label>'
      + '<label>地点<input id="plLoc" class="tr-input" placeholder="项目现场/培训中心"></label>'
      + '<label>讲师<input id="plTrainer" class="tr-input" placeholder="讲师姓名"></label>'
      + '<label>受众<input id="plAud" class="tr-input" placeholder="参训人员"></label>'
      + '<label>状态<select id="plStatus" class="tr-input"><option value="planned">待实施</option><option value="ongoing">实施中</option><option value="done">已完成</option></select></label>'
      + '<label>关联课程(可多选)<select id="plCourses" class="tr-input" multiple>'+courseOpts+'</select></label>'
      + '</div>';
    showModal('新增培训计划', body, [
      {text:'取消', cls:'btn-outline', action:function(){App.closeModal();}},
      {text:'保存', cls:'btn-primary', action:function(){
        var title=document.getElementById('plTitle').value.trim();
        if(!title){App.toast('请填写计划名称','warn');return;}
        var t2=Store.getTraining();
        var courses=Array.from(document.getElementById('plCourses').selectedOptions).map(function(o){return o.value;});
        var plans=t2.plans.slice();
        plans.push({id:'pl_'+Date.now(), title:title, date:document.getElementById('plDate').value||'-', location:document.getElementById('plLoc').value||'-', trainer:document.getElementById('plTrainer').value||'-', audience:document.getElementById('plAud').value||'-', courseIds:courses, status:document.getElementById('plStatus').value});
        Store.updateTraining('plans', plans);
        App.closeModal(); App.showTrainingModule('plan'); App.toast('培训计划已保存','success');
      }}
    ]);
  }
  function delTrainingPlan(id) {
    var t=Store.getTraining();
    Store.updateTraining('plans', t.plans.filter(function(p){return p.id!==id;}));
    App.showTrainingModule('plan'); App.toast('计划已删除','info');
  }
  function renderTrainingProgress() {
    var t = Store.getTraining();
    var plans={}; t.plans.forEach(function(p){plans[p.id]=p;});
    if(!t.progress.length) return '<div class="tr-section"><h4 class="tr-section-title">培训进度 / 完成情况</h4><p class="tr-empty">暂无进度记录</p></div>';
    var rows = t.progress.map(function(pr){
      var pname = plans[pr.planId]?plans[pr.planId].title:pr.planId;
      var pct = pr.rate||0;
      return '<div class="tr-progress-row">'
        + '<div class="tr-progress-meta"><span class="tr-progress-trainee">'+trEsc(pr.trainee)+'</span><span class="tr-progress-plan">'+trEsc(pname)+'</span><span class="tr-progress-rate">'+pct+'%</span></div>'
        + '<div class="tr-progress-bar"><div class="tr-progress-fill" style="width:'+pct+'%"></div></div>'
        + '<div class="tr-progress-foot"><span class="tr-status tr-status-'+pr.status+'">'+statusLabel(pr.status)+'</span> 已完成课程：'+((pr.completedCourses||[]).length)+' 门</div>'
        + '</div>';
    }).join('');
    return '<div class="tr-section"><h4 class="tr-section-title">培训进度 / 完成情况</h4>'+rows+'</div>';
  }
  function renderTrainingMaterials() {
    var t = Store.getTraining();
    var courseOpts = t.outline.map(function(c){return '<option value="'+c.id+'">'+trEsc(c.name)+'</option>';}).join('');
    var rows = t.materials.map(function(m){
      var cn = courseNameOf(m.courseId);
      var isMeta = m.id.indexOf('meta_') === 0;
      var dlBtn = isMeta
        ? '<span class="tr-meta-hint" title="该条仅元数据，未上传实际文件">仅元数据</span>'
        : '<button class="btn btn-xs" onclick="App.downloadMaterial(\''+m.id+'\')">下载</button>';
      return '<tr><td>'+trEsc(m.title)+'</td><td>'+typeLabel(m.type)+'</td><td>'+trEsc(cn)+'</td>'
        + '<td>'+trEsc(m.fileName)+'</td><td>'+(m.sizeKB?Math.round(m.sizeKB/1024*10)/10+' MB':'-')+'</td>'
        + '<td>'+trEsc(m.updatedAt||'')+'</td>'
        + '<td>'+dlBtn+' <button class="btn btn-xs btn-danger" onclick="App.delMaterial(\''+m.id+'\')">删减</button></td></tr>';
    }).join('');
    return '<div class="tr-section"><div class="tr-toolbar">'
      + '<label class="btn btn-sm btn-primary">+ 上传教材<input type="file" id="materialFile" style="display:none" onchange="App.uploadMaterial(this)"></label>'
      + '<label>关联课程：<select id="materialCourse" class="tr-input tr-input-inline">'+courseOpts+'</select></label>'
      + '<button class="btn btn-sm btn-outline" onclick="App.addMaterialMeta()">+ 新增(仅元数据)</button></div>'
      + '<table class="tr-table"><thead><tr><th>教材名称</th><th>类型</th><th>关联课程</th><th>文件名</th><th>大小</th><th>更新日期</th><th>操作</th></tr></thead><tbody>'+rows+'</tbody></table>'
      + '<p class="tr-hint">支持 PPT / WORD / EXCEL 等教材上传，文件存于本机浏览器(IndexedDB)，刷新不丢失；可删减 / 更新。</p></div>';
  }
  function uploadMaterial(input){
    var f=input.files&&input.files[0]; if(!f) return;
    var courseSel=document.getElementById('materialCourse');
    var courseId=courseSel?courseSel.value:'';
    var ext=(f.name.split('.').pop()||'').toLowerCase();
    var typeMap={ppt:'ppt',pptx:'ppt',doc:'doc',docx:'doc',xls:'xls',xlsx:'xls'};
    var type=typeMap[ext]||'doc';
    var id='file_'+Date.now();
    Store.TrainingDB.putFile(id, f).then(function(){
      var t=Store.getTraining();
      var mats=t.materials.slice();
      mats.push({id:id, title:f.name.replace(/\.[^.]+$/,'')||f.name, type:type, courseId:courseId, fileName:f.name, sizeKB:Math.round(f.size/1024), updatedAt:todayStr(), note:''});
      Store.updateTraining('materials', mats);
      App.showTrainingModule('materials'); App.toast('教材已上传：'+f.name,'success');
    }).catch(function(e){ App.toast('上传失败：'+e.message,'error'); });
  }
  function addMaterialMeta(){
    var t=Store.getTraining();
    var courseOpts=t.outline.map(function(c){return '<option value="'+c.id+'">'+trEsc(c.name)+'</option>';}).join('');
    var body='<div class="tr-form-grid">'
      +'<label>教材名称<input id="mmTitle" class="tr-input" placeholder="教材名称"></label>'
      +'<label>类型<select id="mmType" class="tr-input"><option value="ppt">PPT</option><option value="doc">WORD</option><option value="xls">EXCEL</option></select></label>'
      +'<label>关联课程<select id="mmCourse" class="tr-input">'+courseOpts+'</select></label>'
      +'<label>文件名<input id="mmFile" class="tr-input" placeholder="如：课件.pptx"></label>'
      +'<label>备注<input id="mmNote" class="tr-input" placeholder="说明(可选)"></label></div>';
    showModal('新增教材(仅元数据)', body, [
      {text:'取消', cls:'btn-outline', action:function(){App.closeModal();}},
      {text:'保存', cls:'btn-primary', action:function(){
        var title=document.getElementById('mmTitle').value.trim(); if(!title){App.toast('请填写教材名称','warn');return;}
        var t2=Store.getTraining();
        var mats=t2.materials.slice();
        mats.push({id:'meta_'+Date.now(), title:title, type:document.getElementById('mmType').value, courseId:document.getElementById('mmCourse').value, fileName:document.getElementById('mmFile').value||title, sizeKB:0, updatedAt:todayStr(), note:document.getElementById('mmNote').value});
        Store.updateTraining('materials', mats);
        App.closeModal(); App.showTrainingModule('materials'); App.toast('教材已新增','success');
      }}
    ]);
  }
  function downloadMaterial(id){
    Store.TrainingDB.getFile(id).then(function(blob){
      if(!blob){App.toast('该教材未上传实际文件（仅登记元数据），请在「上传教材」重新上传','warn');return;}
      var meta=(Store.getTraining().materials.find(function(m){return m.id===id;})||{});
      var url=URL.createObjectURL(blob);
      var a=document.createElement('a'); a.href=url; a.download=meta.fileName||'download'; document.body.appendChild(a); a.click(); setTimeout(function(){URL.revokeObjectURL(url);a.remove();},1000);
      App.toast('已开始下载：'+(meta.fileName||'文件'),'success');
    }).catch(function(e){ App.toast('下载失败','error'); });
  }
  function delMaterial(id){
    Store.TrainingDB.deleteFile(id).catch(function(){});
    var t=Store.getTraining();
    Store.updateTraining('materials', t.materials.filter(function(m){return m.id!==id;}));
    App.showTrainingModule('materials'); App.toast('教材已删减','info');
  }
  function renderTrainingExam() {
    var rule = '<ul class="tr-exam-rules">'
      + '<li><b>容易</b>：25 道单选题 × 4 分 = 100 分</li>'
      + '<li><b>中等</b>：20 道单选 × 3 分 + 10 道多选 × 4 分 = 100 分</li>'
      + '<li><b>困难</b>：15 道单选 × 2 分 + 14 道多选 × 5 分 = 100 分</li>'
      + '<li>合格线：≥ 60 分；题库跨全部 8 门课程随机抽取，每次组卷不同</li></ul>';
    return '<div class="tr-section"><div class="tr-exam-setup">'
      + '<label>难度：<select id="examDiff" class="tr-input tr-input-inline"><option value="easy">容易</option><option value="medium">中等</option><option value="hard">困难</option></select></label>'
      + '<button class="btn btn-sm btn-primary" onclick="App.startExam()">生成试卷并答题</button>'
      + '</div>'+rule+'<div id="examArea"></div>'
      + '<p class="tr-hint">系统从全部课程的题库中随机抽取组卷，在线作答提交后自动阅卷出分，并可将试卷分享至微信/QQ/企业微信/飞书供受训者远程作答，结果自动回传统计。</p></div>';
  }
  function shuffleArr(a){ for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=a[i];a[i]=a[j];a[j]=t;} return a; }
  function assignPts(q,pts){ var c=JSON.parse(JSON.stringify(q)); c.points=pts; return c; }
  function generateExam(diff){
    var courses = Store.getTraining().outline;
    var allSingle=[], allMulti=[];
    courses.forEach(function(c){ (c.questions||[]).forEach(function(q){ if(q.type==='single') allSingle.push(q); else allMulti.push(q); }); });
    shuffleArr(allSingle); shuffleArr(allMulti);
    var qs=[], title='';
    if(diff==='easy'){
      var ns=Math.min(25, allSingle.length);
      qs = allSingle.slice(0,ns).map(function(q){return assignPts(q,4);});
      title='综合培训考试（容易）';
    } else if(diff==='medium'){
      var nsm=Math.min(20, allSingle.length), nmm=Math.min(10, allMulti.length);
      qs = allSingle.slice(0,nsm).map(function(q){return assignPts(q,3);}).concat(allMulti.slice(0,nmm).map(function(q){return assignPts(q,4);}));
      title='综合培训考试（中等）';
    } else {
      var nsh=Math.min(15, allSingle.length), nmh=Math.min(14, allMulti.length);
      qs = allSingle.slice(0,nsh).map(function(q){return assignPts(q,2);}).concat(allMulti.slice(0,nmh).map(function(q){return assignPts(q,5);}));
      title='综合培训考试（困难）';
    }
    return {id:'ex_'+Date.now(), difficulty:diff, title:title, questions:qs, createdAt:todayStr()};
  }
  function startExam(){
    var diff=document.getElementById('examDiff').value;
    var exam=generateExam(diff);
    if(!exam || !exam.questions.length){App.toast('题库为空，无法组卷','error');return;}
    _trExamCache=exam;
    var t=Store.getTraining(); var exams=(t.exams||[]).slice(); exams.push(exam); Store.updateTraining('exams', exams);
    var qHtml=exam.questions.map(function(q,idx){
      var inputs = q.options.map(function(op,oi){
        var tag = q.type==='multi'?'checkbox':'radio';
        var name = 'eq_'+exam.id+'_'+idx;
        return '<label class="tr-q-opt"><input type="'+tag+'" name="'+name+'" value="'+oi+'"> '+trEsc(op)+'</label>';
      }).join('');
      return '<div class="tr-q"><div class="tr-q-title">'+(idx+1)+'. '+trEsc(q.q)+' <span class="tr-q-type">['+(q.type==='multi'?'多选':'单选')+(q.points?(' · '+q.points+'分'):'')+']</span></div><div class="tr-q-opts">'+inputs+'</div></div>';
    }).join('');
    var html='<div class="tr-exam-box">'
      + '<div class="tr-exam-head">'+trEsc(exam.title)+' ｜ 难度：'+diffLabel(diff)+' ｜ 共 '+exam.questions.length+' 题，满分 100 分</div>'
      + '<div class="tr-exam-trainee"><label>受训者姓名：<input id="examTrainee" class="tr-input tr-input-inline" placeholder="请输入姓名"></label></div>'
      + qHtml
      + '<div class="tr-exam-actions"><button class="btn btn-sm btn-primary" onclick="App.submitExam(\''+exam.id+'\')">提交试卷</button>'
      + '<button class="btn btn-sm btn-outline" onclick="App.shareExam(\''+exam.id+'\')">分享试卷</button></div>'
      + '</div>';
    var area=document.getElementById('examArea'); if(area) area.innerHTML=html;
  }
  function submitExam(examId){
    var exam=_trExamCache;
    if(!exam || exam.id!==examId){ var t0=Store.getTraining(); exam=(t0.exams||[]).find(function(e){return e.id===examId;}); }
    if(!exam){App.toast('试卷数据丢失，请重新生成','error');return;}
    var trainee=document.getElementById('examTrainee')?document.getElementById('examTrainee').value.trim():'匿名';
    if(!trainee){App.toast('请填写受训者姓名','warn');return;}
    var total=0, gained=0;
    exam.questions.forEach(function(q,idx){
      var pts=q.points||1; total+=pts;
      var name='eq_'+exam.id+'_'+idx;
      var sel=Array.from(document.querySelectorAll('input[name="'+name+'"]:checked')).map(function(el){return parseInt(el.value);}).sort();
      var ans=Array.isArray(q.answer)?q.answer.slice().sort():(q.answer==null?[]:[q.answer]);
      if(JSON.stringify(sel)===JSON.stringify(ans)) gained+=pts;
    });
    var pct = total>0?Math.round(gained/total*100):0;
    var passed = pct>=60;
    var sub={id:'sub_'+Date.now(), examId:examId, trainee:trainee, score:gained, total:total, passed:passed, submittedAt:todayStr()+' '+nowTime()};
    var t=Store.getTraining(); var subs=(t.submissions||[]).slice(); subs.push(sub); Store.updateTraining('submissions', subs);
    var area=document.getElementById('examArea');
    if(area) area.innerHTML='<div class="tr-exam-result"><h4>答题完成</h4>'
      + '<p>得分：<b>'+gained+' / '+total+'</b>（'+pct+' 分）</p>'
      + '<p>结果：'+(passed?'<span class="tr-pass">合格</span>':'<span class="tr-fail">不合格</span>')+'</p>'
      + '<p class="tr-hint">成绩已自动阅卷并计入「成绩统计 / 成绩查询」。</p>'
      + '<button class="btn btn-sm btn-outline" onclick="App.showTrainingModule(\'exam\')">返回</button></div>';
    App.toast(passed?'考试合格':'考试不合格','info');
  }
  function shareExam(examId){
    var exam=_trExamCache;
    if(!exam||exam.id!==examId){ var t=Store.getTraining(); exam=(t.exams||[]).find(function(e){return e.id===examId;}); }
    if(!exam){App.toast('试卷数据丢失','error');return;}
    var payload={ title:exam.title, difficulty:exam.difficulty, questions:exam.questions.map(function(q){return {type:q.type,q:q.q,options:q.options,points:q.points,answer:q.answer};}) };
    var enc = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
    var base = location.origin + location.pathname.replace(/index\.html$/,'');
    var link = base + 'exam.html?e=' + encodeURIComponent(enc);
    var qr = 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=' + encodeURIComponent(link);
    var body = '<div class="tr-share">'
      + '<div class="tr-share-qr"><img src="'+qr+'" alt="二维码" onerror="this.style.display=\'none\';this.parentNode.querySelector(\'.tr-share-link-text\').style.display=\'block\';"><div class="tr-share-link-text" style="display:none;word-break:break-all">'+trEsc(link)+'</div></div>'
      + '<div class="tr-share-link"><input id="examShareLink" class="tr-input" readonly value="'+trEsc(link)+'"><button class="btn btn-xs btn-primary" onclick="App.copyText(\'examShareLink\')">复制链接</button></div>'
      + '<div class="tr-share-btns">'
      +   '<button class="btn btn-xs" onclick="App.copyShare(\'wechat\',\''+enc+'\')">微信</button>'
      +   '<button class="btn btn-xs" onclick="App.copyShare(\'qq\',\''+enc+'\')">QQ</button>'
      +   '<button class="btn btn-xs" onclick="App.copyShare(\'wecom\',\''+enc+'\')">企业微信</button>'
      +   '<button class="btn btn-xs" onclick="App.copyShare(\'feishu\',\''+enc+'\')">飞书</button>'
      + '</div>'
      + '<p class="tr-hint">将链接或二维码发给受训者，对方打开即可答题；提交后姓名与成绩会自动回传，管理员在「成绩查询」粘贴回传码即可入账统计。</p>'
      + '</div>';
    showModal('分享试卷', body, [{text:'关闭',cls:'btn-outline',action:function(){App.closeModal();}}]);
  }
  function copyText(id){ var el=document.getElementById(id); if(el){ el.select(); try{ document.execCommand('copy'); App.toast('已复制链接','success'); }catch(e){ App.toast('复制失败，请手动复制','warn'); } } }
  function copyShare(platform, enc){
    var base = location.origin + location.pathname.replace(/index\.html$/,'');
    var link = base + 'exam.html?e=' + encodeURIComponent(enc);
    var map={wechat:'微信',qq:'QQ',wecom:'企业微信',feishu:'飞书'};
    var text='【'+(map[platform]||'同事')+'】储能培训考试，请点击链接作答：'+link;
    copyToClipboard(text); App.toast('已复制'+(map[platform]||'')+'分享文案','success');
  }
  function copyToClipboard(text){ if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(text).catch(function(){}); } else { var ta=document.createElement('textarea'); ta.value=text; document.body.appendChild(ta); ta.select(); try{ document.execCommand('copy'); }catch(e){} ta.remove(); } }
  function importResult(){
    var el=document.getElementById('resultCodeInput'); if(!el) return;
    var code=el.value.trim(); if(!code){App.toast('请粘贴回传码','warn');return;}
    try{
      var json = decodeURIComponent(escape(atob(code)));
      var r = JSON.parse(json);
      if(!r || typeof r.score!=='number'){ App.toast('回传码无效','error'); return; }
      var t=Store.getTraining(); var subs=(t.submissions||[]).slice();
      subs.push({id:'sub_'+Date.now(), examId:r.examId||'shared', trainee:r.trainee||'匿名', score:r.score, total:(r.total||100), passed:(r.score>=(r.total||100)*0.6), submittedAt:r.submittedAt||(todayStr()+' '+nowTime()), shared:true});
      Store.updateTraining('submissions', subs);
      App.showTrainingModule('scoreQuery'); App.toast('成绩已回传入账','success');
    }catch(e){ App.toast('回传码解析失败','error'); }
  }
  function renderTrainingScoreStat() {
    var t = Store.getTraining();
    var subs = t.submissions||[];
    if(!subs.length) return '<div class="tr-section"><p class="tr-empty">暂无考试成绩，请先在「培训考试」中作答并提交。</p></div>';
    var total = subs.length, passed = subs.filter(function(s){return s.passed;}).length;
    var avg = Math.round(subs.reduce(function(a,s){return a+s.score;},0)/total);
    var maxScore = subs.reduce(function(a,s){return Math.max(a,s.total);},0);
    var buckets=[0,0,0,0,0];
    subs.forEach(function(s){var r=s.score; if(r<60)buckets[0]++; else if(r<70)buckets[1]++; else if(r<80)buckets[2]++; else if(r<90)buckets[3]++; else buckets[4]++;});
    var labels=['<60','60-69','70-79','80-89','90-100'];
    var distBars = buckets.map(function(b,i){var pct= total? Math.round(b/total*100):0; return '<div class="tr-dist-row"><span class="tr-dist-label">'+labels[i]+'</span><div class="tr-dist-bar"><div class="tr-dist-fill" style="width:'+pct+'%"></div></div><span class="tr-dist-val">'+b+' ('+pct+'%)</span></div>';}).join('');
    var rows = subs.map(function(s){
      var exam=(t.exams||[]).find(function(e){return e.id===s.examId;});
      var cn=exam?courseNameOf(exam.courseId):'-';
      return '<tr><td>'+trEsc(s.trainee||'匿名')+'</td><td>'+trEsc(cn)+'</td><td>'+s.score+'/'+s.total+'</td><td>'+(s.passed?'<span class="tr-pass">合格</span>':'<span class="tr-fail">不合格</span>')+'</td><td>'+trEsc(s.submittedAt||'')+'</td></tr>';
    }).join('');
    return '<div class="tr-section"><div class="tr-stat-cards">'
      + statCard('参考人数', total) + statCard('合格率', Math.round(passed/total*100)+'%') + statCard('平均分', avg) + statCard('满分', maxScore)
      + '</div>'
      + '<h4 class="tr-section-title">分数分布</h4>'+distBars
      + '<h4 class="tr-section-title">成绩明细</h4><table class="tr-table"><thead><tr><th>受训者</th><th>课程</th><th>得分</th><th>结果</th><th>提交时间</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
  }
  function renderTrainingScoreQuery() {
    return '<div class="tr-section">'
      + '<div class="tr-toolbar"><input type="text" id="scoreQueryInput" class="tr-input" style="max-width:320px" placeholder="输入学员姓名或课程关键字查询" oninput="App.queryScore(this.value)"></div>'
      + '<div class="tr-import-box"><label>回传码入账：<input type="text" id="resultCodeInput" class="tr-input" placeholder="粘贴受训者提交后生成的回传码"><button class="btn btn-xs btn-primary" onclick="App.importResult()">入账</button></label><span class="tr-hint-inline">来自分享链接远程作答的受训者，提交后会生成回传码，粘贴此处即可计入统计</span></div>'
      + '<div id="scoreQueryResult">'+buildScoreQueryTable('')+'</div></div>';
  }
  function buildScoreQueryTable(kw){
    var t=Store.getTraining(); var subs=(t.submissions||[]).slice();
    if(kw){kw=kw.trim(); subs=subs.filter(function(s){var exam=(t.exams||[]).find(function(e){return e.id===s.examId;}); var cn=exam?courseNameOf(exam.courseId):''; return (s.trainee||'').indexOf(kw)>=0 || cn.indexOf(kw)>=0;});}
    if(!subs.length) return '<p class="tr-empty">无匹配成绩记录</p>';
    var rows=subs.map(function(s){var exam=(t.exams||[]).find(function(e){return e.id===s.examId;}); var cn=exam?courseNameOf(exam.courseId):'-'; return '<tr><td>'+trEsc(s.trainee||'匿名')+'</td><td>'+trEsc(cn)+'</td><td>'+s.score+'/'+s.total+'</td><td>'+(s.passed?'<span class="tr-pass">合格</span>':'<span class="tr-fail">不合格</span>')+'</td><td>'+trEsc(s.submittedAt||'')+'</td></tr>';}).join('');
    return '<table class="tr-table"><thead><tr><th>受训者</th><th>课程</th><th>得分</th><th>结果</th><th>提交时间</th></tr></thead><tbody>'+rows+'</tbody></table>';
  }
  function queryScore(kw){var el=document.getElementById('scoreQueryResult'); if(el) el.innerHTML=buildScoreQueryTable(kw);}
  function renderTrainingFeedback() {
    var t = Store.getTraining();
    var hist = (t.feedback||[]).slice().reverse().map(function(f){
      return '<div class="tr-fb-item"><div class="tr-fb-head"><span class="tr-fb-from">'+trEsc(f.from||'匿名')+'</span><span class="tr-fb-type">'+fbTypeLabel(f.type)+'</span><span class="tr-fb-date">'+trEsc(f.createdAt||'')+'</span></div><div class="tr-fb-content">'+trEsc(f.content)+'</div></div>';
    }).join('');
    return '<div class="tr-section"><div class="tr-fb-form">'
      + '<h4>提交培训建议 / 反馈</h4>'
      + '<input type="text" id="fbFrom" class="tr-input" placeholder="您的称呼">'
      + '<input type="text" id="fbContact" class="tr-input" placeholder="联系方式(可选)">'
      + '<select id="fbType" class="tr-input"><option value="content">培训内容</option><option value="form">培训形式</option><option value="trainer">讲师</option><option value="other">其他</option></select>'
      + '<textarea id="fbContent" class="tr-textarea" placeholder="请填写您对培训内容、形式、讲师等的意见或建议..."></textarea>'
      + '<button class="btn btn-sm btn-primary" onclick="App.submitTrainingFeedback()">提交反馈</button>'
      + '</div><h4 class="tr-section-title">历史反馈（'+(t.feedback||[]).length+'）</h4>'+ (hist||'<p class="tr-empty">暂无反馈</p>') +'</div>';
  }
  function sendTrainingEmail(subject, htmlBody, textBody){
    return new Promise(function(resolve){
      try {
        var xhr=new XMLHttpRequest();
        xhr.open('POST', _apiBaseUrl+'/api/send-email', true);
        xhr.setRequestHeader('Content-Type','application/json');
        xhr.timeout=8000;
        xhr.onload=function(){ try{ resolve(JSON.parse(xhr.responseText)); }catch(e){ resolve({success:false,error:'parse'}); } };
        xhr.onerror=function(){ resolve({success:false,error:'network'}); };
        xhr.ontimeout=function(){ resolve({success:false,error:'timeout'}); };
        xhr.send(JSON.stringify({to:'18372757379@139.com',subject:subject,text:textBody,html:htmlBody}));
      } catch(e){ resolve({success:false,error:String(e)}); }
    });
  }
  function submitTrainingFeedback(){
    var from=document.getElementById('fbFrom').value.trim();
    var contact=document.getElementById('fbContact').value.trim();
    var type=document.getElementById('fbType').value;
    var content=document.getElementById('fbContent').value.trim();
    if(!content){App.toast('请填写反馈内容','warn');return;}
    var fb={id:'fb_'+Date.now(), from:from||'匿名', contact:contact, type:type, content:content, createdAt:todayStr()+' '+nowTime(), handled:false};
    var t=Store.getTraining(); var list=(t.feedback||[]).slice(); list.push(fb); Store.updateTraining('feedback', list);
    var subject='[培训反馈] '+fbTypeLabel(type)+' - 来自'+(from||'匿名');
    var text='反馈类型：'+fbTypeLabel(type)+'\n反馈人：'+(from||'匿名')+'\n联系方式：'+(contact||'无')+'\n内容：\n'+content+'\n\n(ESS交付管理系统 自动生成)';
    var html='<div style="font-family:Arial"><h3>培训反馈 / 建议</h3><p><b>类型：</b>'+fbTypeLabel(type)+'</p><p><b>反馈人：</b>'+(from||'匿名')+'</p><p><b>联系方式：</b>'+(contact||'无')+'</p><p><b>内容：</b></p><p>'+trEsc(content).replace(/\n/g,'<br>')+'</p><hr><p style="color:#94a3b8;font-size:12px;">ESS交付管理系统 自动生成 | '+fb.createdAt+'</p></div>';
    sendTrainingEmail(subject, html, text).then(function(r){
      if(r && r.success){ toast('反馈已发送至培训工程师邮箱','success'); }
      else { fallbackMailto(subject, text); toast('已尝试通过邮件客户端发送反馈','info'); }
    });
    App.showTrainingModule('feedback');
  }

  function buildHandoverDeliveryCard() {
    return buildDeliveryTableCard('移交与交付协同',[
      {item:'EOMM用户手册交付(A03)',owner:'文档工程师',deadline:'移交时',status:'pending'},
      {item:'MCD施工完工报告',owner:'项目经理',deadline:'移交前',status:'pending'},
      {item:'遗留项清单处理',owner:'交付经理',deadline:'PAC后30天',status:'pending'},
      {item:'备品备件清点移交',owner:'仓库/物流',deadline:'移交时',status:'pending'},
      {item:'客户培训完成确认',owner:'培训工程师',deadline:'商运前',status:'pending'}
    ]);
  }

  // ========== Tab 8: 售后服务（次级标签内容完整化）==========
  function renderAftersalesTab() {
    const subTabs = [
      {id:'af-warranty',name:'质保管理'},{id:'af-defect',name:'缺陷工单'},
      {id:'af-upgrade',name:'系统升级'},{id:'af-support',name:'技术支持'},{id:'af-survey',name:'满意度调查'}
    ];
    return `
      <div class="sub-tab-nav af-sub-tabs" id="afSubTabs">
        ${subTabs.map(st => `<button class="sub-tab-btn${st.id==='af-warranty'?' active':''}" data-tab-group="af" data-subtab="${st.id}">${st.name}</button>`).join('')}
      </div>
      <div id="afSubContentArea">
        <div class="sub-tab-panel active" data-panel="af-warranty">${renderAfWarrantyContent()}</div>
        <div class="sub-tab-panel" data-panel="af-defect">${renderAfDefectContent()}</div>
        <div class="sub-tab-panel" data-panel="af-upgrade">${renderAfUpgradeContent()}</div>
        <div class="sub-tab-panel" data-panel="af-support">${renderAfSupportContent()}</div>
        <div class="sub-tab-panel" data-panel="af-survey">${renderAfSurveyContent()}</div>
      </div>
    `;
  }

  function renderAfWarrantyContent() {
    return buildThreeColLayout(
      `<div class="card"><div class="card-header">质保期倒计时</div><div class="card-body">
        <div class="warranty-countdown active" id="warrantyCountdown">--</div>
        <div class="text-sm text-muted">质保起始: <span id="warrantyStart">待定</span></div>
        <div class="text-sm text-muted">质保到期: <span id="warrantyEnd">待定</span></div>
        <div class="mt-2">
          <label class="text-xs">质保起始日</label><input type="date" class="inline-input" id="warrantyStartInput" onchange="App.updateWarranty()" style="width:100%">
          <label class="text-xs mt-1">质保期限(月)</label>
          <div style="position:relative;display:inline-block;width:100px;">
            <select class="inline-input" id="warrantyMonthsSelect" onchange="App.onWarrantyMonthSelect(this)" style="width:100%;padding-right:28px;appearance:auto;-webkit-appearance:menulist;">
              <option value="">自定义...</option>
              <option value="12">12 (1年)</option>
              <option value="24" selected>24 (2年)</option>
              <option value="36">36 (3年)</option>
              <option value="48">48 (4年)</option>
              <option value="60">60 (5年)</option>
              <option value="96">96 (8年)</option>
              <option value="120">120 (10年)</option>
              <option value="180">180 (15年)</option>
              <option value="240">240 (20年)</option>
            </select>
          </div>
          <input type="number" class="inline-input" id="warrantyMonths" value="24" onchange="App.updateWarranty()" min="1" max="360" style="width:70px;margin-left:4px;" title="或直接输入月数">
        </div>
      </div></div>`,
      buildAftersalesDeliveryCard(),
      buildRiskCard('8_aftersales',[
        {level:'high',text:'质保期内重大缺陷→4h响应/24h到场/72h闭环'},
        {level:'medium',text:'备品备件短缺→备件V3清单对照+最低库存预警'},
        {level:'low',text:'客户满意度下降→季度满意度调查跟踪'}
      ])
    );
  }
  function renderAfDefectContent() {
    return buildThreeColLayout(
      buildProgressCard('af-def','缺陷工单处理流程',[{id:'ad1',name:'客户报故/响应'},{id:'ad2',name:'故障分类与定级'},{id:'ad3',name:'远程诊断/现场排查'},{id:'ad4',name:'修复方案执行'},{id:'ad5',name:'验证关闭/客户确认'}]),
      buildDeliveryTableCard('缺陷工单管理',[
        {item:'SLA响应时间: 严重<4h/一般<24h/轻微<48h',owner:'售后',deadline:'按SLA',status:'warn'},
        {item:'缺陷累计技术文档',owner:'技术',deadline:'关闭后',status:'pending'},
        {item:'备件更换记录',owner:'售后',deadline:'更换后',status:'pending'}]),
      buildRiskCard('8_af_defect',[{level:'high',text:'缺陷响应超时→升级通知+加快处理'}])
    );
  }
  function renderAfUpgradeContent() {
    return buildThreeColLayout(
      buildProgressCard('af-upg','系统升级管理',[{id:'au1',name:'升级需求评估'},{id:'au2',name:'升级方案制定(远程/现场)'},{id:'au3',name:'固件升级(BMS/PCS/EMS)'},{id:'au4',name:'升级验证+回退'},{id:'au5',name:'升级文档更新'}]),
      buildDeliveryTableCard('升级管理',[
        {item:'BMS固件最新版本管理',owner:'技术',deadline:'季度',status:'info'},
        {item:'EMS系统功能更新',owner:'技术',deadline:'按需',status:'pending'},
        {item:'升级前备份/回退方案',owner:'技术',deadline:'升级前',status:'warn'}]),
      buildRiskCard('8_af_upgrade',[
        {level:'high',text:'升级失败/变砖→必须先备份+验证回退方案'},
        {level:'high',text:'BMS固件兼容性→升级前确认硬件版本匹配'},
        {level:'medium',text:'EMS功能退步→升级后全功能回归测试'},
        {level:'low',text:'通信协议变更→PCS/BMS联动测试(推荐)'}
      ])
    );
  }
  function renderAfSupportContent() {
    return buildThreeColLayout(
      buildProgressCard('af-sup','技术服务',[{id:'as1',name:'技术咨询(电话/远程)'},{id:'as2',name:'现场服务'},{id:'as3',name:'定期巡检服务'},{id:'as4',name:'年度综检服务'},{id:'as5',name:'保质期前检服务'}]),
      buildDeliveryTableCard('技术支持',[
        {item:'7×24技术热线咨询',owner:'技术支持',deadline:'24h响应',status:'info'},
        {item:'远程上门诊断服务',owner:'技术',deadline:'接单前',status:'pending'},
        {item:'定期巡检报告',owner:'运维',deadline:'每季/年',status:'pending'}]),
      buildRiskCard('8_af_support',[
        {level:'high',text:'技术支持响应超时→升级至高级工程师+加急'},
        {level:'medium',text:'现场服务人员不足→区域服务网点布局优化'},
        {level:'medium',text:'巡检遗漏→巡检清单100%逐项打勾确认'},
        {level:'low',text:'技术知识库过时→季度更新FAQ和故障案例'}
      ])
    );
  }
  function renderAfSurveyContent() {
    // 延迟加载快速统计数据
    setTimeout(function(){ loadQuickStats(); }, 100);
    return `
    <!-- 顶部操作栏：标题 + 调查问卷入口按钮 -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:10px;">
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="font-size:18px;">📋</span>
        <h3 style="font-size:15px;color:var(--c-gray-700);margin:0;font-weight:700;">满意度调查管理</h3>
        <span id="surveyBadge" style="background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;font-size:11px;padding:2px 8px;border-radius:10px;font-weight:600;display:none;">已收0份</span>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn btn-primary" onclick="App.openSatisfactionSurvey()" style="font-size:12px;padding:7px 18px;border-radius:6px;white-space:nowrap;">
          📝 调查问卷
        </button>
        <button class="btn btn-outline" onclick="App.viewSurveyStatistics()" style="font-size:12px;padding:7px 14px;border-radius:6px;white-space:nowrap;">
          📊 查看统计汇总
        </button>
        <button class="btn btn-outline" onclick="App.exportSurveyCSV()" style="font-size:12px;padding:7px 14px;border-radius:6px;white-space:nowrap;">
          📥 导出CSV报告
        </button>
      </div>
    </div>

    <!-- 主区域三栏布局：50%调查管理表 + 30%满意度管理计划 + 20%风险提示 -->
    <div style="display:flex;gap:14px;margin-bottom:16px;align-items:flex-start;">
      <!-- 左侧50%：调查管理表 -->
      <div style="flex:0 0 50%;min-width:0;">
        <div class="card" style="margin-bottom:0;">
          <div class="card-header" style="display:flex;align-items:center;justify-content:space-between;">
            <span>📋 调查管理表</span>
            <span style="font-size:11px;color:#94a3b8;font-weight:400;">共5项跟踪任务</span>
          </div>
          <div class="card-body" style="padding:0;overflow-x:auto;">
            <table style="width:100%;border-collapse:collapse;font-size:12px;table-layout:fixed;">
              <thead><tr style="background:#f1f5f9;">
                <th style="padding:9px 10px;text-align:left;font-weight:600;color:#475569;border-bottom:2px solid #e2e8f0;width:32%;">调查类型</th>
                <th style="padding:9px 8px;text-align:left;font-weight:600;color:#475569;border-bottom:2px solid #e2e8f0;width:18%;">负责人</th>
                <th style="padding:9px 8px;text-align:left;font-weight:600;color:#475569;border-bottom:2px solid #e2e8f0;width:22%;">最迟计划</th>
                <th style="padding:9px 8px;text-align:center;font-weight:600;color:#475569;border-bottom:2px solid #e2e8f0;width:28%;">状态</th>
              </tr></thead>
              <tbody>
                <tr style="border-bottom:1px solid #f1f5f9;background:#fefce8;">
                  <td style="padding:9px 10px;font-weight:500;color:#854d0e;white-space:nowrap;">📝 问卷调查</td>
                  <td style="padding:5px 6px;"><input type="text" value="郑丹" style="width:100%;padding:4px 6px;border:1px solid #d1d5db;border-radius:4px;font-size:11px;box-sizing:border-box;" placeholder="输入姓名"></td>
                  <td style="padding:9px 8px;color:#64748b;white-space:nowrap;">2026Q2完成</td>
                  <td style="padding:5px 6px;text-align:center;"><select onchange="this.style.color=this.value==='done'?'#16a34a':this.value==='progress'?'#2563eb':'#94a3b8'" style="width:100%;padding:4px 6px;border:1px solid #d1d5db;border-radius:4px;font-size:11px;cursor:pointer;color:#d97706;box-sizing:border-box;"><option value="">— 选择状态 —</option><option value="pending">☐ 未开始</option><option value="progress">◉ 进行中</option><option value="done">✓ 已结束</option></select></td>
                </tr>
                <tr style="border-bottom:1px solid #f1f5f9;">
                  <td style="padding:9px 10px;font-weight:500;color:#475569;white-space:nowrap;">客观统计&gt;1分</td>
                  <td style="padding:5px 6px;"><input type="text" value="质量" style="width:100%;padding:4px 6px;border:1px solid #d1d5db;border-radius:4px;font-size:11px;box-sizing:border-box;"></td>
                  <td style="padding:9px 8px;color:#64748b;white-space:nowrap;">每季一次</td>
                  <td style="padding:5px 6px;text-align:center;"><select onchange="this.style.color=this.value==='done'?'#16a34a':this.value==='progress'?'#2563eb':'#94a3b8'" style="width:100%;padding:4px 6px;border:1px solid #d1d5db;border-radius:4px;font-size:11px;cursor:pointer;color:#94a3b8;box-sizing:border-box;"><option value="">— 选择状态 —</option><option value="pending">☐ 未开始</option><option value="progress">◉ 进行中</option><option value="done">✓ 已结束</option></select></td>
                </tr>
                <tr style="border-bottom:1px solid #f1f5f9;">
                  <td style="padding:9px 10px;font-weight:500;color:#475569;white-space:nowrap;">客户评价&gt;1分</td>
                  <td style="padding:5px 6px;"><input type="text" value="质量" style="width:100%;padding:4px 6px;border:1px solid #d1d5db;border-radius:4px;font-size:11px;box-sizing:border-box;"></td>
                  <td style="padding:9px 8px;color:#64748b;white-space:nowrap;">每有一次</td>
                  <td style="padding:5px 6px;text-align:center;"><select onchange="this.style.color=this.value==='done'?'#16a34a':this.value==='progress'?'#2563eb':'#94a3b8'" style="width:100%;padding:4px 6px;border:1px solid #d1d5db;border-radius:4px;font-size:11px;cursor:pointer;color:#94a3b8;box-sizing:border-box;"><option value="">— 选择状态 —</option><option value="pending">☐ 未开始</option><option value="progress">◉ 进行中</option><option value="done">✓ 已结束</option><option value="self" selected>☐ 自评</option></select></td>
                </tr>
                <tr style="border-bottom:1px solid #f1f5f9;">
                  <td style="padding:9px 10px;font-weight:500;color:#475569;white-space:nowrap;">参与出证及提出意见</td>
                  <td style="padding:5px 6px;"><input type="text" value="质量" style="width:100%;padding:4px 6px;border:1px solid #d1d5db;border-radius:4px;font-size:11px;box-sizing:border-box;"></td>
                  <td style="padding:9px 8px;color:#64748b;white-space:nowrap;">交付后见证</td>
                  <td style="padding:5px 6px;text-align:center;"><select onchange="this.style.color=this.value==='done'?'#16a34a':this.value==='progress'?'#2563eb':'#94a3b8'" style="width:100%;padding:4px 6px;border:1px solid #d1d5db;border-radius:4px;font-size:11px;cursor:pointer;color:#94a3b8;box-sizing:border-box;"><option value="">— 选择状态 —</option><option value="pending">☐ 未开始</option><option value="progress">◉ 进行中</option><option value="done">✓ 已结束</option></select></td>
                </tr>
                <tr style="border-bottom:1px solid #f1f5f9;">
                  <td style="padding:9px 10px;font-weight:500;color:#475569;white-space:nowrap;">改进效果验证</td>
                  <td style="padding:5px 6px;"><input type="text" value="质量" style="width:100%;padding:4px 6px;border:1px solid #d1d5db;border-radius:4px;font-size:11px;box-sizing:border-box;"></td>
                  <td style="padding:9px 8px;color:#64748b;white-space:nowrap;">整改后</td>
                  <td style="padding:5px 6px;text-align:center;"><select onchange="this.style.color=this.value==='done'?'#16a34a':this.value==='progress'?'#2563eb':'#94a3b8'" style="width:100%;padding:4px 6px;border:1px solid #d1d5db;border-radius:4px;font-size:11px;cursor:pointer;color:#94a3b8;box-sizing:border-box;"><option value="">— 选择状态 —</option><option value="pending">☐ 未开始</option><option value="progress">◉ 进行中</option><option value="done">✓ 已结束</option></select></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- 中间30%：满意度管理计划 -->
      <div style="flex:0 0 30%;min-width:0;">
        <div class="card" style="margin-bottom:0;">
          <div class="card-header">📋 满意度管理</div>
          <div class="card-body" style="padding:0;overflow-x:auto;">
            <table style="width:100%;border-collapse:collapse;font-size:12px;table-layout:fixed;">
              <thead><tr style="background:#f1f5f9;">
                <th style="padding:8px 10px;text-align:left;font-weight:600;color:#475569;border-bottom:2px solid #e2e8f0;width:36%;">协同事项</th>
                <th style="padding:8px 6px;text-align:left;font-weight:600;color:#475569;border-bottom:2px solid #e2e8f0;width:16%;">责任人</th>
                <th style="padding:8px 6px;text-align:left;font-weight:600;color:#475569;border-bottom:2px solid #e2e8f0;width:24%;">截止日期</th>
                <th style="padding:8px 6px;text-align:center;font-weight:600;color:#475569;border-bottom:2px solid #e2e8f0;width:24%;">状态</th>
              </tr></thead>
              <tbody>
                <tr style="border-bottom:1px solid #f1f5f9;background:#fefce8;">
                  <td style="padding:8px 10px;font-weight:500;color:#854d0e;white-space:nowrap;">季度调查计划</td>
                  <td style="padding:5px 6px;"><input type="text" value="质量" style="width:100%;padding:4px 6px;border:1px solid #d1d5db;border-radius:4px;font-size:11px;box-sizing:border-box;"></td>
                  <td style="padding:8px 6px;color:#64748b;white-space:nowrap;">每季度</td>
                  <td style="padding:5px 6px;text-align:center;"><select onchange="this.style.color=this.value==='done'?'#16a34a':this.value==='progress'?'#2563eb':this.value==='info'?'#3b82f6':'#d97706'" style="width:100%;padding:4px 6px;border:1px solid #d1d5db;border-radius:4px;font-size:11px;cursor:pointer;color:#d97706;box-sizing:border-box;"><option value="">— 选择 —</option><option value="pending">⏳ 待开始</option><option value="progress">◉ 进行中</option><option value="done">✓ 已完成</option><option value="info">ℹ️ 信息</option></select></td>
                </tr>
                <tr style="border-bottom:1px solid #f1f5f9;">
                  <td style="padding:8px 10px;font-weight:500;color:#475569;white-space:nowrap;">年度NPS评分</td>
                  <td style="padding:5px 6px;"><input type="text" value="商务" style="width:100%;padding:4px 6px;border:1px solid #d1d5db;border-radius:4px;font-size:11px;box-sizing:border-box;"></td>
                  <td style="padding:8px 6px;color:#64748b;white-space:nowrap;">每年一次</td>
                  <td style="padding:5px 6px;text-align:center;"><select onchange="this.style.color=this.value==='done'?'#16a34a':this.value==='progress'?'#2563eb':this.value==='info'?'#3b82f6':'#94a3b8'" style="width:100%;padding:4px 6px;border:1px solid #d1d5db;border-radius:4px;font-size:11px;cursor:pointer;color:#3b82f6;box-sizing:border-box;"><option value="">— 选择 —</option><option value="pending">⏳ 待开始</option><option value="progress">◉ 进行中</option><option value="done">✓ 已完成</option><option value="info" selected>ℹ️ 信息</option></select></td>
                </tr>
                <tr style="border-bottom:1px solid #f1f5f9;">
                  <td style="padding:8px 10px;font-weight:500;color:#475569;white-space:nowrap;">客户应用处理记录</td>
                  <td style="padding:5px 6px;"><input type="text" value="套服" style="width:100%;padding:4px 6px;border:1px solid #d1d5db;border-radius:4px;font-size:11px;box-sizing:border-box;"></td>
                  <td style="padding:8px 6px;color:#64748b;white-space:nowrap;">发现即处理</td>
                  <td style="padding:5px 6px;text-align:center;"><select onchange="this.style.color=this.value==='done'?'#16a34a':this.value==='progress'?'#2563eb':this.value==='info'?'#3b82f6':'#d97706'" style="width:100%;padding:4px 6px;border:1px solid #d1d5db;border-radius:4px;font-size:11px;cursor:pointer;color:#d97706;box-sizing:border-box;"><option value="">— 选择 —</option><option value="pending">⏳ 待开始</option><option value="progress">◉ 进行中</option><option value="done">✓ 已完成</option><option value="info">ℹ️ 信息</option></select></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- 右侧20%：风险提示与对策 -->
      <div style="flex:0 0 20%;min-width:200px;">
        ${buildRiskCard('8_af_survey',[
          {level:'high',text:'问卷回收率低于60%→多渠道推送+礼品激励'},
          {level:'medium',text:'客户评分偏低→专项回访+整改追踪'},
          {level:'medium',text:'改进措施未落地→季度复盘+责任到人'},
          {level:'low',text:'NPS下降趋势→竞品对比+服务升级'},
          {level:'low',text:'调研报告滞后→自动化生成+定时推送'}
        ])}
      </div>
    </div>

    <!-- 数据指标卡片区（4列均布） -->
    <div id="surveyQuickStats" style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:16px;"></div>
    `;
  }

  // ========== 满意度调查问卷系统 ==========
  var _surveyData = {
    version: '1.0',
    product: 'ArcBank储能系统客户满意度调查问卷',
    sections: [
      {
        id: 's1', title: '📦 产品质量', icon: '📦', weight: 0.25,
        questions: [
          {id:'q1_1', text:'产品整体质量满意度', desc:'对ArcBank储能系统整体制造工艺、材料品质的满意程度'},
          {id:'q1_2', text:'电池性能表现', desc:'电芯一致性、容量保持率、充放电效率等核心指标'},
          {id:'q1_3', text:'BMS系统可靠性', desc:'电池管理系统数据采集精度、保护功能、均衡策略'},
          {id:'q1_4', text:'PCS变流器稳定性', desc:'转换效率、谐波控制、并网性能'},
          {id:'q1_5', text:'液冷/消防系统安全性', desc:'热管理效果、消防联动可靠性'}
        ]
      },
      {
        id: 's2', title: '🚚 交付过程（重点）', icon: '🚚', weight: 0.30,
        questions: [
          {id:'q2_1', text:'交付周期达成情况', desc:'从合同签订到最终交付的时间是否符合预期'},
          {id:'q2_2', text:'现场安装质量', desc:'预制舱安装、电气连接、接地等施工质量'},
          {id:'q2_3', text:'FAT工厂验收体验', desc:'出厂验收流程的专业性、严谨性和效率'},
          {id:'q2_4', text:'物流运输保障', desc:'包装防护、运输时效、到货完好率'},
          {id:'q2_5', text:'FAC现场验收体验', desc:'现场调试验收的配合度、问题响应速度'},
          {id:'q2_6', text:'项目文档完整性', desc:'技术资料、操作手册、验收报告等文件齐全性'},
          {id:'q2_7', text:'项目沟通协调效率', desc:'项目各环节的信息传递及时性与准确性'}
        ]
      },
      {
        id: 's3', title: '🔧 技术支持', icon: '🔧', weight: 0.20,
        questions: [
          {id:'q3_1', text:'售前技术咨询质量', desc:'方案设计阶段的技术专业度和响应速度'},
          {id:'q3_2', text:'培训服务效果', desc:'操作培训、维护培训的内容完整性和易懂性'},
          {id:'q3_3', text:'远程技术支持能力', desc:'电话/远程诊断解决问题的能力'},
          {id:'q3_4', text:'现场技术服务水平', desc:'工程师专业技能和服务态度'}
        ]
      },
      {
        id: 's4', title: '🛠 售后服务', icon: '🛠', weight: 0.15,
        questions: [
          {id:'q4_1', text:'故障响应速度', desc:'报故后的首次响应时间'},
          {id:'q4_2', text:'问题解决效率', desc:'从报修到彻底解决的平均时长'},
          {id:'q4_3', text:'备件供应及时性', desc:'备品备件的库存充足度和发货速度'},
          {id:'q4_4', text:'质保期内服务态度', desc:'售后人员的服务意识和专业素养'}
        ]
      },
      {
        id: 's5', title: '⭐ 综合评价', icon: '⭐', weight: 0.10,
        questions: [
          {id:'q5_1', text:'总体满意度评分', desc:'对我司储能产品与服务的综合评价'},
          {id:'q5_2', text:'NPS推荐意愿', desc:'您向同行或合作伙伴推荐我司产品的可能性'},
          {id:'q5_3', text:'复购意向', desc:'未来储能项目继续选择我司产品的意愿'}
        ]
      }
    ],
    responses: JSON.parse(localStorage.getItem('ess_survey_responses')||'[]')
  };

  // 打分选项定义 (1-10分)
  var _scoreOptions = [
    {val:1, label:'1分 - 非常不满意', color:'#ef4444'},
    {val:2, label:'2分 - 很不满意', color:'#f87171'},
    {val:3, label:'3分 - 不满意', color:'#fb923c'},
    {val:4, label:'4分 - 较不满意', color:'#fbbf24'},
    {val:5, label:'5分 - 一般', color:'#facc15'},
    {val:6, label:'6分 - 较满意', color:'#a3e635'},
    {val:7, label:'7分 - 满意', color:'#84cc16'},
    {val:8, label:'8分 - 很满意', color:'#22c55e'},
    {val:9, label:'9分 - 非常满意', color:'#16a34a'},
    {val:10, label:'10分 - 极其满意', color:'#15803d'}
  ];

  function openSatisfactionSurvey(){
    var modal = document.getElementById('modalContainer');
    if(!modal) return;
    modal.innerHTML = '<div class="modal-overlay" onclick="App.closeModal()" style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto;">'
      + '<div class="modal-body" onclick="event.stopPropagation()" style="background:#fff;border-radius:16px;width:100%;max-width:900px;margin:20px auto;box-shadow:0 25px 50px rgba(0,0,0,0.25);max-height:90vh;overflow-y:auto;">'
      + renderSurveyForm()
      + '</div></div>';
    bindSurveyEvents();
    loadQuickStats();
  }

  function renderSurveyForm(){
    return `
    <div style="padding:32px;">
      <div style="text-align:center;margin-bottom:28px;padding-bottom:20px;border-bottom:2px solid #e5e7eb;">
        <div style="font-size:40px;margin-bottom:8px;">📋</div>
        <h2 style="font-size:22px;color:#1e293b;margin-bottom:6px;">${_surveyData.product}</h2>
        <p style="color:#64748b;font-size:13px;">版本 ${_surveyData.version} | 请根据您的真实体验进行评分（1-10分）</p>
      </div>

      <!-- 基本信息 -->
      <div style="background:#f8fafc;border-radius:12px;padding:20px;margin-bottom:24px;">
        <h3 style="font-size:15px;color:#334155;margin-bottom:14px;">👤 调查对象信息</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
          <div><label style="display:block;font-size:12px;color:#64748b;margin-bottom:4px;font-weight:600;">姓名/称呼 *</label><input type="text" id="surveyName" class="inline-input" placeholder="请输入姓名" style="width:100%"></div>
          <div><label style="display:block;font-size:12px;color:#64748b;margin-bottom:4px;font-weight:600;">所属单位</label><input type="text" id="surveyCompany" class="inline-input" placeholder="请输入单位名称" style="width:100%"></div>
          <div><label style="display:block;font-size:12px;color:#64748b;margin-bottom:4px;font-weight:600;">职位/角色</label><select id="surveyRole" class="inline-input" style="width:100%"><option value="">请选择...</option><option value="业主">项目业主</option><option value="epc">EPC总包</option><option value="operator">运维方</option><option value="design">设计院</option><option value="other">其他</option></select></div>
          <div><label style="display:block;font-size:12px;color:#64748b;margin-bottom:4px;font-weight:600;">调查日期</label><input type="date" id="surveyDate" class="inline-input" value="${new Date().toISOString().slice(0,10)}" style="width:100%"></div>
        </div>
      </div>

      <!-- 问卷主体 -->
      ${_surveyData.sections.map(function(sec){
        return '<div style="margin-bottom:28px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">'
          + '<div style="background:linear-gradient(135deg,#3b82f6,#2563eb);color:#fff;padding:14px 20px;font-size:16px;font-weight:700;">'
          + sec.title + ' <span style="font-size:12px;opacity:0.85;font-weight:400;">(权重 '+Math.round(sec.weight*100)+'%)</span>'
          + '</div>'
          + '<div style="padding:18px 20px;">'
          + sec.questions.map(function(q){
            return '<div style="margin-bottom:18px;padding-bottom:16px;border-bottom:1px dashed #e2e8f0;">'
              + '<div style="font-size:13.5px;font-weight:600;color:#334155;margin-bottom:4px;">'+q.text+'</div>'
              + '<div style="font-size:11.5px;color:#94a3b8;margin-bottom:10px;">'+q.desc+'</div>'
              + '<div style="display:flex;gap:4px;flex-wrap:wrap;" data-qid="'+q.id+'">'
              + _scoreOptions.map(function(opt){
                return '<button type="button" class="survey-score-btn" data-qid="'+q.id+'" data-val="'+opt.val+'" '
                  + 'style="padding:5px 9px;border:1.5px solid #e2e8f0;border-radius:6px;font-size:12px;cursor:pointer;background:#fff;color:#475569;transition:all 0.15s;"'
                  + 'onmouseover="this.style.borderColor=\''+opt.color+'\'" onmouseout="if(!this.classList.contains(\'selected\'))this.style.borderColor=\'#e2e8f0\'"'
                  + 'onclick="App.selectScore(this,\''+q.id+'\','+opt.val+')">'+opt.val+'分</button>';
              }).join('')
              + '<span class="survey-score-display" id="display_'+q.id+'" style="margin-left:8px;font-size:12px;color:#94a3b8;font-weight:600;min-width:80px;"></span>'
              + '</div>'
            + '</div>';
          }).join('')
          + '<div style="margin-top:12px;text-align:right;"><span class="section-avg" id="avg_'+sec.id+'" style="font-size:13px;color:#6366f1;font-weight:700;"></span></div>'
          + '</div>'
        + '</div>';
      }).join('')}

      <!-- 意见建议 -->
      <div style="background:#fefce8;border:1.5px solid #fde047;border-radius:12px;padding:20px;margin-bottom:24px;">
        <h3 style="font-size:15px;color:#854d0e;margin-bottom:12px;">💬 意见与建议</h3>
        <div style="margin-bottom:12px;">
          <label style="display:block;font-size:12px;color:#a16207;margin-bottom:4px;font-weight:600;">您认为我们需要改进的方面有哪些？</label>
          <textarea id="surveyImprove" class="inline-input" rows="3" placeholder="请详细描述您的建议..." style="width:100%;resize:vertical;"></textarea>
        </div>
        <div>
          <label style="display:block;font-size:12px;color:#a16207;margin-bottom:4px;font-weight:600;">其他补充意见或表扬</label>
          <textarea id="surveyComment" class="inline-input" rows="2" placeholder="可选填..." style="width:100%;resize:vertical;"></textarea>
        </div>
      </div>

      <!-- 提交按钮 -->
      <div style="text-align:center;padding:16px 0 8px;">
        <div id="surveySubmitArea">
          <button type="button" id="btnSubmitSurvey" class="btn btn-primary" onclick="App.submitSurvey()" style="font-size:15px;padding:13px 52px;border-radius:10px;transition:all 0.2s;cursor:pointer;">✅ 提交调查问卷</button>
          <button type="button" class="btn btn-outline" onclick="App.closeModal()" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='#fff'" style="font-size:13px;padding:11px 28px;margin-left:14px;border-radius:8px;cursor:pointer;transition:all 0.2s;">取消</button>
        </div>
        <div id="surveySuccessArea" style="display:none;text-align:center;padding:20px;">
          <div style="font-size:48px;margin-bottom:12px;">🎉</div>
          <h3 style="color:#16a34a;font-size:18px;margin-bottom:6px;">提交成功！感谢您的反馈</h3>
          <p id="surveySuccessScore" style="color:#64748b;font-size:13px;margin-bottom:16px;"></p>
          
          <!-- 操作状态提示 -->
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px;margin-bottom:16px;text-align:left;">
            <div style="font-size:12px;color:#166534;margin-bottom:8px;font-weight:600;">📋 自动操作状态：</div>
            <div id="emailStatus" style="font-size:11px;color:#15803d;margin-bottom:4px;">✅ 邮件客户端已打开（请查收并发送）</div>
            <div id="csvStatus" style="font-size:11px;color:#15803d;margin-bottom:4px;">✅ CSV文件已自动下载</div>
            <div id="cloudStatus" style="font-size:11px;color:#ca8a04;">⚠️ 请手动上传CSV到云盘（见下方指引）</div>
          </div>

          <!-- 云盘上传指引 -->
          <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px;margin-bottom:16px;text-align:left;">
            <div style="font-size:12px;color:#1e40af;margin-bottom:8px;font-weight:600;">☁️ 云盘上传指引：</div>
            <div style="font-size:11px;color:#3b82f6;line-height:1.6;">
              1. 下载的CSV文件已保存到本地<br>
              2. 访问云盘：<a href="https://www.go127.com/home?path=cloudreve%3A%2F%2Fmy%2FESS%2FESS%2F%25E8%25B0%2583%25E7%25A0%2594%2F%25E6%25BB%25A1%25E6%2584%258F%25E5%25BA%25A6%25E8%25B0%2583%25E6%259F%25A5" target="_blank" style="color:#2563eb;text-decoration:underline;">打开云盘目录</a><br>
              3. 点击"上传"按钮，选择刚下载的CSV文件<br>
              4. 上传完成后可关闭此窗口
            </div>
          </div>

          <button class="btn btn-outline" onclick="App.handleSurveyClose()" style="font-size:13px;padding:10px 28px;border-radius:8px;">关闭</button>
        </div>
      </div>
    </div>`;
  }

  function selectScore(btn,qid,val){
    var container=btn.parentElement;
    container.querySelectorAll('.survey-score-btn').forEach(function(b){
      b.classList.remove('selected');
      b.style.background='#fff';
      b.style.color='#475569';
      b.style.borderColor='#e2e8f0';
      b.style.fontWeight='normal';
    });
    btn.classList.add('selected');
    var opt=_scoreOptions.find(function(o){return o.val===val;});
    if(opt){
      btn.style.background=opt.color;
      btn.style.color='#fff';
      btn.style.borderColor=opt.color;
      btn.style.fontWeight='700';
    }
    document.getElementById('display_'+qid).textContent='已选：'+val+'分';
    document.getElementById('display_'+qid).style.color=opt?opt.color:'#15803d';
    updateSectionAverages();
  }

  function updateSectionAverages(){
    _surveyData.sections.forEach(function(sec){
      var total=0,count=0;
      sec.questions.forEach(function(q){
        var sel=document.querySelector('[data-qid="'+q.id+'"].selected');
        if(sel){total+=parseInt(sel.dataset.val);count++;}
      });
      var el=document.getElementById('avg_'+sec.id);
      if(el&&count>0){
        var avg=(total/count).toFixed(1);
        el.textContent='该维度平均：'+avg+' / 10 分';
        el.style.color=parseFloat(avg)>=8?'#16a34a':parseFloat(avg)>=6?'#d97706':'#dc2626';
      }else if(el){el.textContent='';}
    });
  }

  function submitSurvey(){
    var btn=document.getElementById('btnSubmitSurvey');
    // 防重复提交 + 按钮loading状态
    if(btn&&btn.disabled)return;
    if(btn){btn.disabled=true;btn.textContent='⏳ 提交中...';btn.style.opacity='0.7';}

    var name=document.getElementById('surveyName').value.trim();
    if(!name){toast('请填写姓名','error');document.getElementById('surveyName').focus();if(btn){btn.disabled=false;btn.textContent='✅ 提交调查问卷';btn.style.opacity='1';}return;}

    var scores={},allScores=[],totalWtd=0,totalWeight=0;
    _surveyData.sections.forEach(function(sec){
      sec.questions.forEach(function(q){
        var sel=document.querySelector('[data-qid="'+q.id+'"].selected');
        scores[q.id]=sel?parseInt(sel.dataset.val):null;
        if(scores[q.id]!==null) allScores.push(scores[q.id]*sec.weight/sec.questions.length);
      });
      var secTotal=0,secCount=0;
      sec.questions.forEach(function(q){
        if(scores[q.id]!==null){secTotal+=scores[q.id];secCount++;}
      });
      if(secCount>0){totalWtd+=(secTotal/secCount)*sec.weight;totalWeight+=sec.weight;}
    });

    // Check at least 70% answered
    var totalQ=_surveyData.sections.reduce(function(s,sec){return s+sec.questions.length;},0);
    var answered=Object.values(scores).filter(function(v){return v!==null;}).length;
    if(answered<totalQ*0.7){toast('请至少完成70%的评分项','warn');if(btn){btn.disabled=false;btn.textContent='✅ 提交调查问卷';btn.style.opacity='1';}return;}

    var response={
      id:'R'+Date.now(),
      name:name,
      company:(document.getElementById('surveyCompany')||{}).value.trim()||'未填写',
      role:(document.getElementById('surveyRole')||{}).value||'未填写',
      date:(document.getElementById('surveyDate')||{}).value||new Date().toISOString().slice(0,10),
      scores:scores,
      overallScore:Math.round(totalWtd*10)/10,
      improve:(document.getElementById('surveyImprove')||{}).value.trim()||'无',
      comment:(document.getElementById('surveyComment')||{}).value.trim()||'无',
      submittedAt:new Date().toISOString()
    };
    _surveyData.responses.push(response);
    localStorage.setItem('ess_survey_responses',JSON.stringify(_surveyData.responses));

    // 📧 智能邮件发送（优先后端API，降级mailto）
    try {
      var emailBody = buildSurveyEmailBody(response);
      var emailSubject = 'ESS交付管理系统 - 客户满意度调查问卷 - ' + response.name;
      var emailEl = document.getElementById('emailStatus');
      
      // 尝试调用后端API发送
      sendEmailViaAPI(emailSubject, emailBody, response).then(function(result) {
        if (result && result.success) {
          // API发送成功
          if(emailEl) { emailEl.innerHTML = '✅ 邮件已通过API成功发送 → ' + (result.to || '18372757379@139.com'); emailEl.style.color = '#16a34a'; }
          console.log('[邮件API] 发送成功, messageId:', result.messageId);
        } else {
          // API失败，降级为mailto
          console.log('[邮件API] 不可用，降级为mailto协议:', result ? result.error : '网络错误');
          fallbackMailto(emailSubject, emailBody);
          if(emailEl) { emailEl.innerHTML = '⚠️ 后端不可用，已打开邮件客户端（请手动发送）'; emailEl.style.color = '#d97706'; }
        }
      }).catch(function(err) {
        // 异常，降级为mailto
        console.warn('[邮件API] 调用异常，降级为mailto:', err.message);
        fallbackMailto(emailSubject, emailBody);
        if(emailEl) { emailEl.innerHTML = '⚠️ 后端连接失败，已打开邮件客户端'; emailEl.style.color = '#d97706'; }
      });
    } catch(e) {
      console.error('邮件生成失败:', e);
    }

    // 📥 自动下载CSV文件
    try {
      setTimeout(function() {
        downloadSurveyCSV(response);
        
        // 🌐 尝试自动上传到云盘（如果后端可用）
        uploadCSVToCloud(response).then(function(result) {
          var cloudEl = document.getElementById('cloudStatus');
          if (cloudEl) {
            if (result && result.success) {
              cloudEl.innerHTML = '✅ CSV已自动上传到云盘';
              cloudEl.style.color = '#16a34a';
            } else {
              cloudEl.innerHTML = '⚠️ 云盘未配置或上传失败，请手动上传（见下方指引）';
              cloudEl.style.color = '#d97706';
            }
          }
        });
      }, 800);
    } catch(e) {
      console.error('CSV下载/上传失败:', e);
    }

    // 显示成功动画
    var submitArea=document.getElementById('surveySubmitArea');
    var successArea=document.getElementById('surveySuccessArea');
    var successScore=document.getElementById('surveySuccessScore');
    if(submitArea)submitArea.style.display='none';
    if(successArea)successArea.style.display='block';
    if(successScore)successScore.textContent='您的综合评分：'+response.overallScore+' / 10 分 | 感谢您宝贵的反馈！';

    toast('问卷提交成功！综合评分：'+response.overallScore+' / 10','success');

    // 2秒后自动关闭并刷新
    setTimeout(function(){
      App.closeModal();
      if(currentTab==='8_aftersales'){switchTab('8_aftersales');}
    },2200);
  }

  // 生成邮件正文
  function buildSurveyEmailBody(response) {
    var lines = [];
    lines.push('========================================');
    lines.push('  ESS交付管理系统 - 客户满意度调查问卷');
    lines.push('========================================');
    lines.push('');
    lines.push('【基本信息】');
    lines.push('姓名：' + response.name);
    lines.push('公司：' + response.company);
    lines.push('角色：' + response.role);
    lines.push('日期：' + response.date);
    lines.push('提交时间：' + new Date(response.submittedAt).toLocaleString());
    lines.push('');
    lines.push('【综合评分】');
    lines.push('综合得分：' + response.overallScore + ' / 10 分');
    lines.push('');
    lines.push('【各维度评分明细】');

    _surveyData.sections.forEach(function(sec) {
      var secTotal = 0, secCount = 0;
      sec.questions.forEach(function(q) {
        if(response.scores[q.id] !== null) {
          secTotal += response.scores[q.id];
          secCount++;
          lines.push('  - ' + q.text + '：' + response.scores[q.id] + ' 分');
        }
      });
      if(secCount > 0) {
        lines.push('  【' + sec.title + '】平均：' + (secTotal/secCount).toFixed(1) + ' 分');
        lines.push('');
      }
    });

    lines.push('【改进建议】');
    lines.push(response.improve || '无');
    lines.push('');
    lines.push('【其他意见】');
    lines.push(response.comment || '无');
    lines.push('');
    lines.push('========================================');
    lines.push('此邮件由ESS交付管理系统自动生成');
    lines.push('问卷ID：' + response.id);
    lines.push('========================================');

    return lines.join('\n');
  }

  // ========== 后端API集成（智能降级）==========

  // 后端API基础地址（可配置，支持相对路径和绝对URL）
  var _apiBaseUrl = (function() {
    // 尝试从localStorage读取自定义API地址
    var custom = localStorage.getItem('ess_api_base_url');
    if (custom) return custom;
    // 默认：与当前页面同源
    return window.location.origin;
  })();

  /**
   * 调用后端API发送邮件
   * @param {string} subject - 邮件主题
   * @param {string} text - 邮件正文（纯文本）
   * @param {object} response - 问卷响应数据（用于生成HTML）
   * @returns {Promise} API调用结果
   */
  function sendEmailViaAPI(subject, text, response) {
    return new Promise(function(resolve) {
      // 构建HTML版本邮件正文
      var html = '<html><body style="font-family:Arial,sans-serif;padding:20px;">'
        + '<h2 style="color:#2563eb;">ESS交付管理系统 - 客户满意度调查问卷</h2>'
        + '<table style="border-collapse:collapse;width:100%;font-size:14px;">'
        + '<tr><td style="border:1px solid #e2e8f0;padding:8px;background:#f8fafc;font-weight:bold;">姓名</td><td style="border:1px solid #e2e8f0;padding:8px;">' + response.name + '</td></tr>'
        + '<tr><td style="border:1px solid #e2e8f0;padding:8px;background:#f8fafc;font-weight:bold;">公司</td><td style="border:1px solid #e2e8f0;padding:8px;">' + response.company + '</td></tr>'
        + '<tr><td style="border:1px solid #e2e8f0;padding:8px;background:#f8fafc;font-weight:bold;">角色</td><td style="border:1px solid #e2e8f0;padding:8px;">' + response.role + '</td></tr>'
        + '<tr><td style="border:1px solid #e2e8f0;padding:8px;background:#f8fafc;font-weight:bold;">日期</td><td style="border:1px solid #e2e8f0;padding:8px;">' + response.date + '</td></tr>'
        + '<tr><td style="border:1px solid #e2e8f0;padding:8px;background:#f8fafc;font-weight:bold;color:#16a34a;">综合评分</td><td style="border:1px solid #e2e8f0;padding:8px;font-size:18px;font-weight:bold;color:#16a34a;">' + response.overallScore + ' / 10 分</td></tr>'
        + '</table>'
        + '<h3 style="margin-top:16px;">各维度评分</h3>';
      
      _surveyData.sections.forEach(function(sec) {
        var secTotal = 0, secCount = 0;
        sec.questions.forEach(function(q) {
          if(response.scores[q.id] !== null) {
            secTotal += response.scores[q.id];
            secCount++;
          }
        });
        if(secCount > 0) {
          var avg = (secTotal/secCount).toFixed(1);
          var color = avg >= 8 ? '#16a34a' : avg >= 6 ? '#d97706' : '#dc2626';
          html += '<p style="margin:4px 0;"><strong>' + sec.title + '</strong>: <span style="color:' + color + ';font-weight:bold;">' + avg + '分</span></p>';
        }
      });

      html += '<h3 style="margin-top:16px;">改进建议</h3><p>' + (response.improve || '无') + '</p>';
      html += '<hr><p style="color:#94a3b8;font-size:12px;">此邮件由 ESS交付管理系统 自动生成 | 问卷ID:' + response.id + '</p>';
      html += '</body></html>';

      // 发送API请求（带超时控制）
      var timeoutId;
      var xhr = new XMLHttpRequest();
      xhr.open('POST', _apiBaseUrl + '/api/send-email', true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.timeout = 8000; // 8秒超时

      xhr.onload = function() {
        clearTimeout(timeoutId);
        try {
          var result = JSON.parse(xhr.responseText);
          result.to = '18372757379@139.com';
          resolve(result);
        } catch(e) {
          resolve({ success: false, error: '解析响应失败: ' + e.message });
        }
      };

      xhr.onerror = function() {
        clearTimeout(timeoutId);
        resolve({ success: false, error: '网络连接失败或后端未启动' });
      };

      xhr.ontimeout = function() {
        resolve({ success: false, error: '请求超时(8s)，后端可能未启动' });
      };

      timeoutId = setTimeout(function() {
        xhr.abort();
        resolve({ success: false, error: '请求超时' });
      }, 8500);

      xhr.send(JSON.stringify({
        to: '18372757379@139.com',
        subject: subject,
        text: text,
        html: html
      }));
    });
  }

  /**
   * 降级方案：使用mailto协议打开邮件客户端
   */
  function fallbackMailto(subject, body) {
    try {
      var mailtoLink = 'mailto:18372757379@139.com?subject=' +
        encodeURIComponent(subject) +
        '&body=' + encodeURIComponent(body);
      window.open(mailtoLink, '_blank');
    } catch(e) {
      console.warn('[mailto] 打开失败:', e.message);
    }
  }

  /**
   * 尝试上传CSV到云盘（通过后端API）
   * @param {object} response - 问卷响应数据
   * @returns {Promise} 上传结果
   */
  function uploadCSVToCloud(response) {
    return new Promise(function(resolve) {
      // 先生成CSV内容
      var BOM = '\uFEFF';
      var csv = BOM + '问卷ID,姓名,公司,角色,日期,综合评分,改进建议\n';
      csv += response.id + ',' + response.name + ',' + response.company + ',';
      csv += response.role + ',' + response.date + ',' + response.overallScore + ',';
      csv += '"' + (response.improve || '').replace(/"/g, '""') + '"\n';

      _surveyData.sections.forEach(function(sec) {
        sec.questions.forEach(function(q) {
          csv += ',' + q.text + ',' + (response.scores[q.id] || '') + '\n';
        });
      });

      var filename = '满意度问卷_' + response.name + '_' + response.date + '.csv';

      // 调用后端上传API
      var xhr = new XMLHttpRequest();
      xhr.open('POST', _apiBaseUrl + '/api/cloud-upload', true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.timeout = 10000; // 10秒超时

      xhr.onload = function() {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch(e) {
          resolve({ success: false, error: e.message });
        }
      };

      xhr.onerror = function() {
        resolve({ success: false, error: '网络连接失败' });
      };

      xhr.ontimeout = function() {
        resolve({ success: false, error: '上传超时' });
      };

      // 将CSV转为base64传输
      var base64 = btoa(unescape(encodeURIComponent(csv)));
      xhr.send(JSON.stringify({
        filename: filename,
        size: csv.length,
        content: base64
      }));
    });
  }

  /**
   * 检测后端API是否可用（异步）
   * @returns {Promise<boolean>}
   */
  function checkBackendAvailable() {
    return new Promise(function(resolve) {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', _apiBaseUrl + '/api/health', true);
      xhr.timeout = 3000;
      xhr.onload = function() {
        try {
          var data = JSON.parse(xhr.responseText);
          resolve(data.status === 'ok');
        } catch(e) { resolve(false); }
      };
      xhr.onerror = function() { resolve(false); };
      xhr.ontimeout = function() { resolve(false); };
      xhr.send();
    });
  }

  // ========== 后端API集成结束 ==========

  // 下载单个问卷的CSV文件
  function downloadSurveyCSV(response) {
    var BOM = '\uFEFF';
    var csv = BOM;

    // CSV头部
    csv += '问卷ID,姓名,公司,角色,日期,综合得分\n';
    csv += [response.id, response.name, response.company, response.role, response.date, response.overallScore].map(function(v) {
      return '"' + String(v).replace(/"/g, '""') + '"';
    }).join(',') + '\n';

    // 各维度评分
    csv += '\n各维度评分\n';
    csv += '维度,问题,得分\n';
    _surveyData.sections.forEach(function(sec) {
      sec.questions.forEach(function(q) {
        var score = response.scores[q.id];
        csv += [sec.title, q.text, score !== null ? score : '未评分'].map(function(v) {
          return '"' + String(v).replace(/"/g, '""') + '"';
        }).join(',') + '\n';
      });
    });

    // 改进建议和意见
    csv += '\n改进建议\n';
    csv += '"' + (response.improve || '无').replace(/"/g, '""') + '"\n';
    csv += '\n其他意见\n';
    csv += '"' + (response.comment || '无').replace(/"/g, '""') + '"\n';

    // 创建下载链接
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var link = document.createElement('a');
    var url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', '满意度问卷_' + response.name + '_' + response.date + '.csv');
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast('CSV文件已下载', 'success');
  }

  function viewSurveyStatistics(){
    if(_surveyData.responses.length===0){
      toast('暂无调查数据，请先收集问卷','info');return;
    }
    var modal=document.getElementById('modalContainer');
    if(!modal)return;
    modal.innerHTML='<div class="modal-overlay" onclick="App.closeModal()" style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto;">'
      +'<div class="modal-body" onclick="event.stopPropagation()" style="background:#fff;border-radius:16px;width:100%;max-width:960px;margin:20px auto;box-shadow:0 25px 50px rgba(0,0,0,0.25);max-height:90vh;overflow-y:auto;">'
      +renderStatsPage()
      +'</div></div>';
  }

  function renderStatsPage(){
    var n=_surveyData.responses.length;
    var overallAvg=n?(_surveyData.responses.reduce(function(s,r){return s+r.overallScore},0)/n):0;

    // Per-section averages
    var sectionAvgs=_surveyData.sections.map(function(sec){
      var vals=[];
      _surveyData.responses.forEach(function(r){
        sec.questions.forEach(function(q){if(r.scores[q.id]!==null)vals.push(r.scores[q.id]);});
      });
      return{title:sec.title,avg:vals.length?((vals.reduce(function(a,b){return a+b},0))/vals.length).toFixed(1):'-',count:vals.length};
    });

    return`
    <div style="padding:32px;">
      <div style="text-align:center;margin-bottom:24px;">
        <h2 style="font-size:22px;color:#1e293b;">📊 满意度调查统计汇总</h2>
        <p style="color:#64748b;font-size:13px;">共收到有效问卷 ${n} 份 | 数据更新时间：${new Date().toLocaleString()}</p>
      </div>

      <!-- 总览卡片 -->
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:28px;">
        <div style="background:linear-gradient(135deg,#3b82f6,#2563eb);border-radius:12px;padding:20px;color:#fff;text-align:center;">
          <div style="font-size:32px;font-weight:800;">${n}</div><div style="font-size:12px;opacity:0.9;margin-top:4px;">回收问卷数</div>
        </div>
        <div style="background:linear-gradient(135deg,#22c55e,#16a34a);border-radius:12px;padding:20px;color:#fff;text-align:center;">
          <div style="font-size:32px;font-weight:800;">${overallAvg.toFixed(1)}</div><div style="font-size:12px;opacity:0.9;margin-top:4px;">平均综合得分</div>
        </div>
        <div style="background:linear-gradient(135deg,#f59e0b,#d97706);border-radius:12px;padding:20px;color:#fff;text-align:center;">
          <div style="font-size:32px;font-weight:800;">${n?(Math.round((_surveyData.responses.filter(function(r){return r.overallScore>=8}).length/n*100))):0}%</div>
          <div style="font-size:12px;opacity:0.9;margin-top:4px;">高满意度占比(≥8)</div>
        </div>
      </div>

      <!-- 各维度得分 -->
      <div style="background:#f8fafc;border-radius:12px;padding:20px;margin-bottom:24px;">
        <h3 style="font-size:15px;color:#334155;margin-bottom:16px;">📈 各维度得分明细</h3>
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr style="background:#e2e8f0;">
            <th style="padding:10px;text-align:left;font-size:13px;">评价维度</th>
            <th style="padding:10px;text-align:center;font-size:13px;">平均得分</th>
            <th style="padding:10px;text-align:center;font-size:13px;">样本量</th>
            <th style="padding:10px;text-align:left;font-size:13px;width:40%;">可视化</th>
          </tr></thead>
          <tbody>
          ${sectionAvgs.map(function(sa){
            var pct=sa.avg!=='-'?parseFloat(sa.avg)*10:0;
            var color=pct>=80?'#22c55e':pct>=60?'#f59e0b':'#ef4444';
            return '<tr style="border-bottom:1px solid #e5e7eb;">'
              +'<td style="padding:10px;font-size:13px;font-weight:600;">'+sa.title+'</td>'
              +'<td style="padding:10px;text-align:center;font-size:14px;font-weight:700;color:'+color+';">'+sa.avg+'</td>'
              +'<td style="padding:10px;text-align:center;font-size:13px;color:#64748b;">'+sa.count+'</td>'
              +'<td style="padding:10px;"><div style="background:#e5e7eb;border-radius:4px;height:12px;width:100%;"><div style="background:'+color+';height:100%;border-radius:4px;width:'+pct+'%;transition:width 0.5s;"></div></div></td>'
              +'</tr>';
          }).join('')}
          </tbody>
        </table>
      </div>

      <!-- 最近提交记录 -->
      <div style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
        <div style="background:#f1f5f9;padding:14px 20px;font-weight:700;font-size:14px;">📋 最近提交记录</div>
        <div style="max-height:320px;overflow-y:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead><tr style="background:#f8fafc;border-bottom:1px solid #e2e8f0;">
            <th style="padding:8px 10px;text-align:left;">姓名</th><th style="padding:8px 10px;text-align:left;">单位</th><th style="padding:8px 10px;text-align:left;">角色</th>
            <th style="padding:8px 10px;text-align:center;">日期</th><th style="padding:8px 10px;text-align:center;">综合分</th>
          </tr></thead>
          <tbody>
          ${_surveyData.responses.slice(-10).reverse().map(function(r){
            return '<tr style="border-bottom:1px solid #f1f5f9;">'
              +'<td style="padding:8px 10px;">'+r.name+'</td>'
              +'<td style="padding:8px 10px;">'+r.company+'</td>'
              +'<td style="padding:8px 10px;">'+r.role+'</td>'
              +'<td style="padding:8px 10px;text-align:center;">'+r.date+'</td>'
              +'<td style="padding:8px 10px;text-align:center;font-weight:700;color:'+(r.overallScore>=8?'#16a34a':r.overallScore>=6?'#d97706':'#dc2626')+';">'+r.overallScore+'</td>'
              +'</tr>';
          }).join('')}
          </tbody>
        </table>
        </div>
      </div>

      <div style="text-align:center;padding:20px 0 8px;">
        <button class="btn btn-outline" onclick="App.closeModal()" style="font-size:13px;padding:10px 28px;border-radius:8px;">关闭</button>
      </div>
    </div>`;
  }

  function exportSurveyCSV(){
    if(_surveyData.responses.length===0){toast('暂无数据可导出','info');return;}
    // Collect ALL question IDs for headers
    var allQIds=[];
    _surveyData.sections.forEach(function(sec){sec.questions.forEach(function(q){allQIds.push({id:q.id,text:q.text});});});

    var headers=['序号','姓名','所属单位','角色','调查日期','综合得分'];
    allQIds.forEach(function(q){headers.push(q.text);});
    headers.push('改进建议','补充意见','提交时间');

    var rows=[headers.join(',')];
    _surveyData.responses.forEach(function(r,idx){
      var row=[idx+1,csvEsc(r.name),csvEsc(r.company),csvEsc(r.role),r.date,r.overallScore];
      allQIds.forEach(function(q){row.push(r.scores[q.id]||'');});
      row.push(csvEsc(r.improve),csvEsc(r.comment),r.submittedAt);
      rows.push(row.join(','));
    });

    // Add summary row
    var summaryRow=['','','','','平均分'];
    allQIds.forEach(function(q){
      var vals=_surveyData.responses.map(function(r){return r.scores[q.id];}).filter(function(v){return v!=null;});
      summaryRow.push(vals.length?(vals.reduce(function(a,b){return a+b},0)/vals.length).toFixed(2):'');
    });
    summaryRow.push('','');
    rows.push(summaryRow.join(','));

    var BOM='\uFEFF';
    var blob=new Blob([BOM+rows.join('\n')],{type:'text/csv;charset=utf-8'});
    var a=document.createElement('a');a.href=URL.createObjectURL(blob);
    a.download='储能客户满意度调查_'+new Date().toISOString().slice(0,10)+'.csv';
    a.click();URL.revokeObjectURL(a.href);
    toast('CSV导出成功！共'+_surveyData.responses.length+'条记录','success');
  }
  function csvEsc(s){return String(s||'').replace(/"/g,'""').replace(/\n/g,' ');}

  function loadQuickStats(){
    var container=document.getElementById('surveyQuickStats');
    if(!container)return;
    var n=_surveyData.responses.length;
    var avg=n?(_surveyData.responses.reduce(function(s,r){return s+r.overallScore},0)/n):0;
    var highPct=n?Math.round((_surveyData.responses.filter(function(r){return r.overallScore>=8}).length/n*100)):0;

    // 更新标题徽章
    var badge=document.getElementById('surveyBadge');
    if(badge){
      if(n>0){badge.style.display='inline-block';badge.textContent='已收'+n+'份';}
      else{badge.style.display='none';}
    }

    // 分析改善重点（从问卷数据中自动提取低分维度）
    var improveItems = analyzeImprovementFocus(n);

    // 渲染4个数据指标卡片
    container.innerHTML=(n>0)?[
      '<div style="background:linear-gradient(135deg,#dbeafe,#bfdbfe);border-radius:10px;padding:18px 16px;text-align:center;border:1px solid #93c5fd;">'
        +'<div style="font-size:26px;font-weight:800;color:#1e40af;">'+n+'<span style="font-size:12px;font-weight:500;margin-left:3px;">份</span></div>'
        +'<div style="font-size:12px;color:#3b82f6;margin-top:4px;font-weight:500;">已回收问卷</div>'
        +'<div style="font-size:11px;color:#60a5fa;margin-top:2px;">最近：'+(n>0?_surveyData.responses[n-1].name:'')+'</div></div>',
      // 平均综合得分 - 添加hover提示
      '<div style="background:linear-gradient(135deg,#dcfce7,#bbf7d0);border-radius:10px;padding:18px 16px;text-align:center;border:1px solid #86efac;position:relative;cursor:help;"'
        +' onmouseenter="this.querySelector(\'#scoreTooltip\').style.display=\'block\'" onmouseleave="this.querySelector(\'#scoreTooltip\').style.display=\'none\'" onclick="var t=this.querySelector(\'#scoreTooltip\');t.style.display=t.style.display===\'block\'?\'none\':\'block\';">'
        +'<div style="font-size:26px;font-weight:800;color:#166534;">'+avg.toFixed(1)+'</div>'
        +'<div style="font-size:12px;color:#22c55e;margin-top:4px;font-weight:500;">平均综合得分</div>'
        +'<div style="font-size:11px;color:#4ade80;margin-top:2px;">满分10分 · 悬浮查看标准</div>'
        // 计分标准tooltip
        +'<div id="scoreTooltip" style="display:none;position:absolute;bottom:105%;left:50%;transform:translateX(-50%);width:260px;background:#1e293b;color:#f8fafc;border-radius:8px;padding:12px 14px;font-size:11px;text-align:left;z-index:10;box-shadow:0 8px 24px rgba(0,0,0,0.2);line-height:1.7;">'
          +'<div style="font-weight:700;color:#f8fafc;margin-bottom:6px;border-bottom:1px solid #475569;padding-bottom:4px;">📊 综合得分计分标准</div>'
          +'<div><b style="color:#93c5fd;">权重分配：</b>产品质量25% · 交付过程30% · 技术支持20% · 售后服务15% · 综合评价10%</div>'
          +'<div style="margin-top:4px;"><b style="color:#93c5fd;">计算方式：</b>各维度加权平均，每题1~10分</div>'
          +'<div style="margin-top:4px;"><b style="color:#93c5fd;">评级参考：</b>≥8.5优秀 · 7~8.4良好 · 6~6.9一般 · &lt;6需改进</div>'
          +'<div style="position:absolute;top:100%;left:50%;transform:translateX(-50%);border:6px solid transparent;border-top-color:#1e293b;"></div>'
        +'</div></div>',
      '<div style="background:linear-gradient(135deg,#fef3c7,#fde68a);border-radius:10px;padding:18px 16px;text-align:center;border:1px solid #fcd34d;">'
        +'<div style="font-size:26px;font-weight:800;color:#b45309;">'+highPct+'%</div>'
        +'<div style="font-size:12px;color:#d97706;margin-top:4px;font-weight:500;">高满意度占比</div>'
        +'<div style="font-size:11px;color:#f59e0b;margin-top:2px;">评分≥8分</div></div>',
      // 改善重点卡片
      '<div style="background:linear-gradient(135deg,#fce7f3,#fbcfe8);border-radius:10px;padding:14px 12px;text-align:left;border:1px solid #f9a8d4;">'
        +'<div style="font-size:12px;color:#9d174d;margin-bottom:8px;font-weight:600;display:flex;align-items:center;gap:4px;">🎯 改善重点</div>'
        + improveItems.map(function(item){
          return '<div style="display:flex;align-items:flex-start;gap:5px;margin-bottom:6px;font-size:11px;color:#831843;line-height:1.5;"><span style="color:#db2777;flex-shrink:0;">▸</span><span>'+item+'</span></div>';
        }).join('')
        +'</div>'
    ].join(''):[
      '<div style="background:#f8fafc;border-radius:10px;padding:18px 16px;text-align:center;border:1px solid #e2e8f0;"><div style="font-size:26px;font-weight:800;color:#94a3b8;">0</div><div style="font-size:12px;color:#94a3b8;margin-top:4px;">已回收问卷</div></div>',
      '<div style="background:#f8fafc;border-radius:10px;padding:18px 16px;text-align:center;border:1px solid #e2e8f0;"><div style="font-size:26px;font-weight:800;color:#94a3b8;">--</div><div style="font-size:12px;color:#94a3b8;margin-top:4px;">平均综合得分</div></div>',
      '<div style="background:#f8fafc;border-radius:10px;padding:18px 16px;text-align:center;border:1px solid #e2e8f0;"><div style="font-size:26px;font-weight:800;color:#94a3b8;">--%</div><div style="font-size:12px;color:#94a3b8;margin-top:4px;">高满意度占比</div></div>',
      '<div style="background:#f8fafc;border-radius:10px;padding:14px 12px;text-align:left;border:1px solid #e2e8f0;"><div style="font-size:12px;color:#94a3b8;margin-bottom:8px;font-weight:600;">🎯 改善重点</div><div style="font-size:11px;color:#94a3b8;line-height:1.6;">暂无数据，待收集问卷后自动分析</div></div>'
    ].join('');

    // 渲染风险看板（全局L4区域）
    if(typeof renderSurveyRiskDashboard==='function')renderSurveyRiskDashboard();
  }

  // 分析改善重点：从已回收问卷中提取需改善的维度和问题
  function analyzeImprovementFocus(n) {
    if (n === 0) return ['暂无数据'];
    var items = [];
    // 1. 分析各维度得分，找出最低维度
    var sectionAvgs = _surveyData.sections.map(function(sec) {
      var vals = [];
      _surveyData.responses.forEach(function(r) {
        sec.questions.forEach(function(q) { if (r.scores[q.id] !== null) vals.push(r.scores[q.id]); });
      });
      return { title: sec.title.replace(/^[^\s]+\s/,''), avg: vals.length ? (vals.reduce(function(a,b){return a+b},0)/vals.length) : null, weight: sec.weight };
    });
    // 按得分升序排列，取最低的3个维度
    sectionAvgs.sort(function(a,b) { return (a.avg||10) - (b.avg||10); });
    for (var i = 0; i < Math.min(3, sectionAvgs.length); i++) {
      if (sectionAvgs[i].avg !== null && sectionAvgs[i].avg < 7.5) {
        items.push(sectionAvgs[i].title + ' 得分偏低(' + sectionAvgs[i].avg.toFixed(1) + '分)，建议专项提升');
      }
    }
    // 2. 统计改进建议中的高频关键词
    var allImproveText = _surveyData.responses.filter(function(r){return r.improve && r.improve !== '无'}).map(function(r){return r.improve;});
    if (allImproveText.length > 0 && items.length < 4) {
      items.push(allImproveText.length + '份问卷提出改进建议，需纳入整改计划');
    }
    // 3. 低分个体提醒
    var lowCount = _surveyData.responses.filter(function(r){return r.overallScore < 6;}).length;
    if (lowCount > 0 && items.length < 4) {
      items.push(lowCount + '位客户评分低于6分，建议逐一回访');
    }
    // 如果项目不足，补充默认项
    while (items.length < 3) { items.push('持续关注客户反馈趋势'); }
    items = items.slice(0, 4);
    return items;
  }

  function renderSurveyRiskDashboard() {
    var dash = document.getElementById('surveyRiskDashboard');
    if (!dash) return;
    var n = _surveyData.responses.length;
    var risks = [];
    if (n === 0) {
      risks.push({level:"info", text:"暂无调查数据，请先通过调查问卷按钮收集反馈"});
    } else {
      var avg = _surveyData.responses.reduce(function(s,r){return s+r.overallScore;},0)/n;
      if (avg < 6) risks.push({level:'high', text:'综合平均分偏低('+avg.toFixed(1)+'分)，需专项分析低分项并制定改进措施'});
      else if (avg < 7.5) risks.push({level:'medium', text:'综合平均分一般('+avg.toFixed(1)+'分)，建议关注交付过程和技术支持维度'});
      else risks.push({level:'low', text:'综合平均分良好('+avg.toFixed(1)+'分），继续保持并关注个体低分项'});
      var lowCount = _surveyData.responses.filter(function(r){return r.overallScore < 6;}).length;
      if (lowCount > 0) risks.push({level:'medium', text:'有'+lowCount+'份问卷评分低于6分，需逐一回访了解原因'});
      var improveCount = _surveyData.responses.filter(function(r){return r.improve && r.improve !== '无';}).length;
      if (improveCount > 0) risks.push({level:'low', text:'有'+improveCount+'份问卷提出改进建议，需汇总分析并纳入整改计划'});
      risks.push({level:"info", text:"最新提交：" + (n > 0 ? _surveyData.responses[n-1].name + " / " + _surveyData.responses[n-1].date : "无")});
    }
    dash.innerHTML = risks.map(function(r) {
      var colorMap = {high:'#fef2f2', medium:'#fffbeb', low:'#f0fdf4', info:'#f0f9ff'};
      var borderMap = {high:'#fecaca', medium:'#fde68a', low:'#bbf7d0', info:'#bae6fd'};
      var dotMap = {high:'#ef4444', medium:'#f59e0b', low:'#22c55e', info:'#3b82f6'};
      return "<div style=\"background:" + colorMap[r.level] + ";border:1px solid " + borderMap[r.level] + ";border-radius:8px;padding:12px 14px;display:flex;align-items:flex-start;gap:8px;\""
        + "<span style=\"display:inline-block;width:8px;height:8px;border-radius:50%;background:" + dotMap[r.level] + ";flex-shrink:0;margin-top:5px;\"></span>"
        + "<span style=\"font-size:12px;color:#475569;line-height:1.6;\">" + r.text + "</span></div>";
    }).join('');
  }

  function bindSurveyEvents() {
    // 问卷使用内联onclick事件绑定，此函数保留用于未来扩展（如动态事件委托）
  }

  // ========== 联系开发者 - 打开邮件客户端 ==========
  function openContactEmail() {
    // 收集客户端信息
    var platform = navigator.platform || 'Unknown OS';
    var userAgent = navigator.userAgent || '';
    var lang = navigator.language || 'zh-CN';
    var screenInfo = screen.width + 'x' + screen.height;
    var timestamp = new Date().toLocaleString('zh-CN', {timeZone: 'Asia/Shanghai'});
    // 尝试获取计算机名（从userAgent中提取）
    var computerName = 'Client';
    if (userAgent.match(/Windows NT/)) computerName = 'Windows';
    else if (userAgent.match(/Mac OS X/)) computerName = 'macOS';
    else if (userAgent.match(/Linux/)) computerName = 'Linux';
    // 尝试通过WebRTC获取本地IP（异步，先打开邮件再补充IP信息）
    var ipInfo = '获取中...';
    // 使用RTCPeerConnection获取本地IP
    try {
      var rtc = new window.RTCPeerConnection({iceServers:[]});
      rtc.createDataChannel('', {reliable:false});
      rtc.onicecandidate = function(e) {
        if (e && e.candidate && e.candidate.candidate) {
          var ipMatch = e.candidate.candidate.match(/(\d+\.\d+\.\d+\.\d+)/);
          if (ipMatch) { ipInfo = ipMatch[1]; }
        }
      };
      rtc.createOffer(function(offer) {
        rtc.setLocalDescription(offer);
      }, function(){});
    } catch(e) { /* WebRTC不可用 */ }

    // 构建邮件主题和正文
    var subject = encodeURIComponent('来自' + computerName + '的反馈');
    var body = ''
      + '您好，\n\n'
      + '我是ESS交付管理系统的使用者，有以下反馈/建议：\n\n'
      + '─────────────────────────\n'
      + '【系统信息】（自动采集）\n'
      + '操作系统：' + platform + '\n'
      + '浏览器：' + userAgent.substring(0, 120) + (userAgent.length > 120 ? '...' : '') + '\n'
      + '语言：' + lang + '\n'
      + '屏幕分辨率：' + screenInfo + '\n'
      + '本地IP：' + ipInfo + '\n'
      + '发送时间：' + timestamp + '\n'
      + '─────────────────────────\n\n'
      + '请在此处填写您的反馈内容...\n';

    // 延迟200ms打开邮件客户端（给WebRTC时间获取IP）
    setTimeout(function() {
      var mailtoLink = 'mailto:18372757379@139.com'
        + '?subject=' + subject
        + '&body=' + encodeURIComponent(body);
      var win = window.open(mailtoLink, '_blank');
      if (!win || win.closed || typeof win.closed === 'undefined') {
        // 如果邮件客户端未打开，提示用户
        toast('未能自动打开邮件客户端，请手动发送至：18372757379@139.com', 'warn');
        // 复制到剪贴板作为备选
        if (navigator.clipboard) {
          navigator.clipboard.writeText('18372757379@139.com').then(function() {
            toast('邮箱地址已复制到剪贴板', 'info');
          });
        }
      } else {
        toast('已打开邮件客户端', 'success');
      }
    }, 300);
  }

  function handleSurveyClose() {
    App.closeModal();
    if (currentTab === '8_aftersales') {
      setTimeout(function() { switchTab('8_aftersales'); }, 200);
    }
  }

  function buildAftersalesDeliveryCard() {
    return buildDeliveryTableCard('售后服务协同',[
      {item:'质保期内设备缺陷/问题处理',owner:'售后工程师',deadline:'按SLA',status:'pending'},
      {item:'系统软件升级(EMS/BMS/PCS)',owner:'技术工程师',deadline:'定期',status:'pending'},
      {item:'技术咨询/远程支持',owner:'技术支持',deadline:'24h响应',status:'pending'},
      {item:'用户投诉/建议处理',owner:'客服专员',deadline:'48h反馈',status:'pending'},
      {item:'客户满意度调查',owner:'质量工程师',deadline:'每季度',status:'pending'}
    ]);
  }

  // ========== Tab 9: 运维管理（极简·仅接口）==========
  function renderOpsTab() {
    return `
      <div style="text-align:center;padding:60px 20px;">
        <div style="font-size:48px;margin-bottom:16px;">📊</div>
        <h3 style="font-size:16px;color:var(--c-gray-700);margin-bottom:8px;"><a href="https://iot.feisjy.com/#/index" target="_blank" style="color:var(--c-primary);text-decoration:none;">🚀 运维管理子系统 ↗</a></h3>
        <p style="color:var(--c-gray-500);font-size:13px;margin-bottom:20px;">
          此为独立子系统接口<br>涵盖日常巡检、定期维护(3月/年度)、SOC/SOH监控、告警管理等功能<br>基于A04运维手册(29页)规划设计
        </p>
        <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;padding:0 40px;">
          <div style="background:var(--c-info-light);border-radius:8px;padding:16px 24px;flex:1;min-width:180px;max-width:260px;">
            <div style="font-size:20px;margin-bottom:6px;">🔄</div><div style="font-weight:600;font-size:13px;">日常巡检</div><div style="font-size:11px;color:var(--c-gray-600);margin-top:4px;">外观/温度/SOC/总绝缘/通讯</div>
          </div>
          <div style="background:var(--c-success-light);border-radius:8px;padding:16px 24px;flex:1;min-width:180px;max-width:260px;">
            <div style="font-size:20px;margin-bottom:6px;">🔧</div><div style="font-weight:600;font-size:13px;">定期维护</div><div style="font-size:11px;color:var(--c-gray-600);margin-top:4px;">季度/年度/清洗/校准/通讯</div>
          </div>
          <div style="background:var(--c-warning-light);border-radius:8px;padding:16px 24px;flex:1;min-width:180px;max-width:260px;">
            <div style="font-size:20px;margin-bottom:6px;">⚠️</div><div style="font-weight:600;font-size:13px;">告警管理</div><div style="font-size:11px;color:var(--c-gray-600);margin-top:4px;">温度/电压/绝缘/通讯/故障</div>
          </div>
        </div>
      </div>`;
  }

  // ========== L4 可折叠信息卡（动态化重构）==========
  function renderFoldableCards() {
    var p = Store.getSelectedProject();
    if (!p) { console.warn('renderFoldableCards: 无项目数据'); return; }
    var phases = p.phases;
    var defs = PHASE_DEFS;
    var currentIdx = Math.max(0, (p.currentPhase || 1) - 1);

    // 动态计算风险
    var risks = [];
    for (var i = 0; i < defs.length - 1; i++) {
      var key = defs[i].key, comp = phases[key]?.completed || 0;
      var nextKey = defs[i+1]?.key, nextComp = phases[nextKey]?.completed || 0;
      if (comp > 0 && comp < 100 && i === currentIdx)
        risks.push({level:'warn',text:defs[i].name+'进行中('+comp+'%)，需持续跟踪'});
      if (comp >= 80 && nextComp === 0 && nextKey)
        risks.push({level:'high',text:defs[i+1].name+'即将启动，需提前准备资源与方案'});
      if (comp === 0 && i < currentIdx)
        risks.push({level:'high',text:defs[i].name+'尚未开始，但后续阶段已启动，请排查'});
    }
    if (p.location && p.location.indexOf('印度') >= 0)
      risks.push({level:'medium',text:'印度项目专项：关注BIS认证/进口清关/内陆运输限重'});
    if (p.contractType === 'BOO')
      risks.push({level:'medium',text:'BOO合同模式：全生命周期成本控制与运维质量尤为关键'});
    if (p.status === '交付中' && currentIdx >= 3 && (phases['4_logistics']?.completed||0) < 20)
      risks.push({level:'high',text:'国际物流风险：海运周期长(25天+)，需提前订舱并确认合规文件'});

    // 关键指标
    var totalComplete = Math.round(defs.reduce(function(s,d){return s+(phases[d.key]?.completed||0);},0) / defs.length);
    var completedPhases = defs.filter(function(d){return (phases[d.key]?.completed||0)===100;}).length;
    var inProgressPhases = defs.filter(function(d){var c=phases[d.key]?.completed||0;return c>0&&c<100;}).length;

    var content = document.getElementById('foldableContent');
    if (!content) return;
    content.innerHTML = '<div class="info-cards-grid">'
      + '<div class="info-mini-card" style="background:var(--c-success-light)"><div class="mini-title">总完成度</div><div class="mini-val">' + totalComplete + '%</div><div class="mini-desc">已完成 ' + completedPhases + '/9 阶段</div></div>'
      + '<div class="info-mini-card" style="background:var(--c-info-light)"><div class="mini-title">当前阶段</div><div class="mini-val">' + (defs[currentIdx]?.name||'N/A') + '</div><div class="mini-desc">第 ' + (currentIdx+1) + '/9 阶段 · ' + p.status + '</div></div>'
      + '<div class="info-mini-card" style="background:var(--c-warning-light)"><div class="mini-title">风险项</div><div class="mini-val">' + risks.length + '</div><div class="mini-desc">' + risks.filter(function(r){return r.level==='high';}).length + '高 ' + risks.filter(function(r){return r.level==='medium';}).length + '中</div></div>'
      + '<div class="info-mini-card" style="background:var(--c-gray-100)"><div class="mini-title">项目规模</div><div class="mini-val">' + p.cabinetCount + ' 柜</div><div class="mini-desc">' + (p.cabinetModel||'') + '</div></div>'
      + '</div>'
      + (risks.length > 0 ? '<div class="mt-2"><div class="section-title" style="font-size:13px;font-weight:600;margin-bottom:8px;">⚠ 当前风险 (' + risks.length + '项)</div>'
        + risks.map(function(r){return '<div class="risk-item ' + (r.level==='high'?'risk-high':(r.level==='medium'?'risk-medium':'risk-low')) + '"><span class="risk-icon">' + (r.level==='high'?'🔴':(r.level==='medium'?'🟡':'🔵')) + '</span>' + r.text + '</div>';}).join('')
      + '</div>' : '<div class="mt-2" style="color:var(--c-success);font-size:13px;">✅ 当前无活跃风险项</div>');
  }

  function toggleFoldable() {
    const toggle = document.querySelector('.foldable-toggle');
    const content = document.getElementById('foldableContent');
    if(toggle&&content){toggle.classList.toggle('open');content.classList.toggle('open');}
  }

  // ========== 辅助构建函数 ==========

  function buildThreeColLayout(left, center, right) {
    return `<div class="tab-grid-3">${left}${center}${right}</div>`;
  }

  function buildTwoColLayout(left, center) {
    return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">${left}${center}</div>`;
  }

  function buildPlaceholderCard(msg) {
    return `<div class="card"><div class="card-body" style="padding:40px;text-align:center;color:var(--c-gray-500);">${msg}</div></div>`;
  }

  function buildProgressCard(prefix, title, steps, phaseKey) {
    phaseKey = phaseKey || getPhaseKeyByPrefix(prefix);
    const p = Store.getSelectedProject();
    const phases = p?.phases || {};
    const pct = phases[phaseKey]?.completed || 0;
    const selAllId = 'selall-' + prefix;

    return `<div class="card">
      <div class="card-header" style="display:flex;align-items:center;gap:6px;">
        <input type="checkbox" id="${selAllId}" onchange="App.toggleSelectAll(this,'${prefix}','${phaseKey}',${steps.length})" title="全选/全不选" style="width:16px;height:16px;cursor:pointer;accent-color:var(--c-primary);flex-shrink:0;">
        <span style="flex:1;">${title}</span>
        <span class="badge ${pct===100?'badge-complete':(pct>0?'badge-progress':'badge-pending')}">${pct}%</span>
      </div>
      <div class="card-body scrollable">
        ${steps.map(st => `
          <div class="progress-card-item" id="pci-${prefix}-${st.id}">
            <input type="checkbox" id="${prefix}-${st.id}" onchange="App.onProgressCheck(this,'${phaseKey}','${prefix}','${st.id}',${steps.length})">
            <label for="${prefix}-${st.id}"><strong>${st.name}</strong></label>
            ${st.desc?`<span class="text-xs text-muted">${st.desc}</span>`:''}
          </div>
        `).join('')}
      </div></div>`;
  }

  function toggleSelectAll(cb, prefix, phaseKey, totalSteps) {
    var allCbs = document.querySelectorAll('[id^="' + prefix + '-"]');
    var checked = cb.checked;
    allCbs.forEach(function(c) {
      if (c.id.indexOf('selall-') === 0) return;
      c.checked = checked;
      var pci = document.getElementById('pci-' + c.id);
      if (pci) pci.classList.toggle('completed', checked);
    });
    if (phaseKey === '2_bd') { updateBDOverallProgress(); }
    else if (phaseKey === '3_mfg') { updateMFGOverallProgress(); }
    else { Store.setPhaseProgress(null, phaseKey, checked ? 100 : 0); }
  }

  function buildDeliveryTableCard(title, items) {
    var statusOptions = '<option value="">— 选择 —</option><option value="pending">⏳ 待开始</option><option value="progress">◉ 进行中</option><option value="done">✓ 已完成</option><option value="processing">⚠ 处理中</option><option value="info">ℹ️ 信息</option>';
    return `<div class="card"><div class="card-header">${title}</div><div class="card-body scrollable" style="padding:0;">
      <table class="delivery-table"><thead><tr><th>协同事项</th><th>责任人</th><th>截止日期</th><th>状态</th></tr></thead><tbody>
        ${items.map(function(it){
          var sVal = it.status==='warn'?'processing':(it.status==='info'?'info':'pending');
          var sColor = sVal==='done'?'#16a34a':sVal==='progress'?'#2563eb':sVal==='processing'?'#d97706':sVal==='info'?'#3b82f6':'#d97706';
          return `<tr><td>${it.item}</td><td><input type="text" value="${it.owner||''}" placeholder="输入姓名" style="width:100%;padding:3px 6px;border:1px solid #d1d5db;border-radius:4px;font-size:11px;box-sizing:border-box;" /></td><td>${it.deadline||'-'}</td>
          <td><select onchange="this.style.color=this.options[this.selectedIndex].style.color||'#d97706'" style="width:100%;padding:4px 6px;border:1px solid #d1d5db;border-radius:4px;font-size:11px;cursor:pointer;color:${sColor};box-sizing:border-box;">${statusOptions}<option value="${sVal}" selected style="color:${sColor}">${sVal==='pending'?'⏳ 待开始':sVal==='progress'?'◉ 进行中':sVal==='done'?'✓ 已完成':sVal==='processing'?'⚠ 处理中':'ℹ️ 信息'}</option></select></td></tr>`;
        }).join('')}
      </tbody></table></div></div>`;
  }

  function buildRiskCard(phaseKey, risks) {
    return `<div class="card"><div class="card-header">⚠ 风险提示与对策</div><div class="card-body scrollable">
      ${risks.map(r => `<div class="risk-item ${r.level==='high'?'risk-high':(r.level==='medium'?'risk-medium':'risk-low')}">
        <span class="risk-icon">${r.level==='high'?'🔴':(r.level==='medium'?'🟡':'🔵')}</span><span>${r.text}</span>
      </div>`).join('')}
    </div></div>`;
  }

  function buildM5ECard(m5e, title, foldable) {
    if (!m5e) return '<div class="card"><div class="card-header">' + (title||'5M1E') + '</div><div class="card-body text-muted">待加载</div></div>';
    var isFold = foldable === true;
    var cardClass = isFold ? 'card card-foldable' : 'card';
    var headerHTML = isFold
      ? '<div class="card-header" onclick="App.toggleCardFold(this)">' + title + ' <input type="checkbox" style="width:16px;height:16px;cursor:pointer;accent-color:var(--c-primary);margin-left:8px;" onchange="App.toggleM5ESelectAll(this)" title="全选"></div>'
      : '<div class="card-header">' + title + '</div>';
    var contentClass = isFold ? 'card-foldable-content' : 'card-body scrollable';
    return '<div class="' + cardClass + '">'
      + headerHTML
      + '<div class="' + contentClass + '">'
      + Object.entries(m5e).map(function(kv){ return '<div style="margin-bottom:6px;"><label style="font-size:12px;cursor:pointer;"><input type="checkbox" class="m5e-checkbox" style="margin-right:6px;"> <strong>' + kv[0] + '</strong></label><br><span class="text-sm text-muted">' + kv[1] + '</span></div>'; }).join('<hr style="border:none;border-top:1px solid var(--c-gray-100);margin:6px 0;">')
      + '</div></div>';
  }

  function buildSafetyCard(items) {
    if (!items) return '';
    return `<div class="card"><div class="card-header">🦺 安全要求</div><div class="card-body">
      ${items.map(s=>`<div class="text-sm" style="padding:2px 0;">✅ ${s}</div>`).join('')}
    </div></div>`;
  }

  function buildCommonIssuesCard(items) {
    if (!items) return '';
    return `<div class="card"><div class="card-header">💡 常见问题及对策</div><div class="card-body scrollable">
      ${items.map(s=>`<div class="risk-item risk-low"><span>${s}</span></div>`).join('')}
    </div></div>`;
  }

  function buildWitnessCard(wm) {
    if (!wm) return '';
    return `<div class="card"><div class="card-header">👥 见证管理</div><div class="card-body">
      <div class="section-title">见证人</div>
      ${(wm.requiredWitnesses||[]).map(w=>`<div class="text-sm flex-between"><span>${w.required?'●':'○'} ${w.role}</span><span class="text-xs text-muted">${w.name||'待确认'}</span></div>`).join('')}
      <div class="section-title mt-2">见证节点</div>
      ${(wm.witnessCheckpoints||[]).map(cp=>`<div class="text-sm" style="padding:2px 0;">📌 ${cp}</div>`).join('')}
    </div></div>`;
  }

  function updateMFGOverallProgress() {
    // 扫描所有MFG相关复选框（订单/装配/包装/FAT）互补计算
    var prefixes = ['mfg-ord-','mfg-asm-','mfg-pk-','fat-','mo','ma','mp'];
    var total = 0, checked = 0;
    var seen = {};
    prefixes.forEach(function(p) {
      document.querySelectorAll('[id^="' + p + '"]').forEach(function(c) {
        if (c.type !== 'checkbox') return;
        if (c.id.indexOf('selall-') === 0) return;
        if (seen[c.id]) return;
        seen[c.id] = true;
        total++; if (c.checked) checked++;
      });
    });
    var pct = total > 0 ? Math.round(checked / total * 100) : 0;
    Store.setPhaseProgress(null, '3_mfg', pct);
  }

  function updateInstallOverallProgress() {
    // 扫描所有安装(install)复选框，从Store读取状态计算进度
    var installSOP = Store.getInstallSOP();
    var phases = installSOP.phases || [];
    var total = 0, passed = 0;
    phases.forEach(function(p) {
      var allChecks = getMergedChecks('install', p);
      allChecks.forEach(function(ch) {
        total++;
        var state = Store.getSOPCheckState(null, 'install', ch.id);
        if (state && state.passed) passed++;
      });
    });
    var pct = total > 0 ? Math.round(passed / total * 100) : 0;
    Store.setPhaseProgress(null, '5_install', pct);
  }

  function updateSATOverallProgress() {
    // 扫描所有调试(sat)复选框，从Store读取状态计算进度
    var satSOP = Store.getSatSOP();
    var phases = satSOP.phases || [];
    var total = 0, passed = 0;
    phases.forEach(function(p) {
      var allChecks = getMergedChecks('sat', p);
      allChecks.forEach(function(ch) {
        total++;
        var state = Store.getSOPCheckState(null, 'sat', ch.id);
        if (state && state.passed) passed++;
      });
    });
    var pct = total > 0 ? Math.round(passed / total * 100) : 0;
    Store.setPhaseProgress(null, '6_commission', pct);
  }

  function updateBDOverallProgress() {
    // 各商务模式独立计算进度，取最高值作为 L2 2.商务拓展 总进度
    // 原因：实际项目只选一种主模式（公开招标/邀请招标互斥），其余辅助模式进度通常较低
    var modes = ['bd-public','bd-invite','bd-rfq','bd-single','bd-direct','bd-nego','bd-consult','bd-agreement'];
    var maxPct = 0;
    modes.forEach(function(mode) {
      var steps = (BD_MODE_DATA[mode] && BD_MODE_DATA[mode].steps) || [];
      var total = steps.length;
      var checked = 0;
      steps.forEach(function(st) {
        var cb = document.getElementById(mode + '-' + st.id);
        if (cb && cb.checked) checked++;
      });
      var pct = total > 0 ? Math.round(checked / total * 100) : 0;
      if (pct > maxPct) maxPct = pct;
    });
    Store.setPhaseProgress(null, '2_bd', maxPct);
  }

  // ========== 进度检查联动 ==========
  function onProgressCheck(cb, phaseKey, prefix, stepId, totalSteps) {
    // BD/MFG模式特殊处理：全局互补叠加计算
    if (phaseKey === '2_bd') { updateBDOverallProgress(); }
    else if (phaseKey === '3_mfg') { updateMFGOverallProgress(); }
    else {
      var allCbs = document.querySelectorAll('[id^="' + prefix + '-"]');
      var total = 0, checked = 0;
      allCbs.forEach(function(c) { if (c.id.indexOf('selall-') !== 0) { total++; if (c.checked) checked++; } });
      var pct = total > 0 ? Math.round(checked / total * 100) : 0;
      Store.setPhaseProgress(null, phaseKey, pct);
    }
    var pci = document.getElementById('pci-' + prefix + '-' + stepId);
    if (pci) pci.classList.toggle('completed', cb.checked);
    // 同步全选框状态
    var selAll = document.getElementById('selall-' + prefix);
    if (selAll) {
      var allInPrefix = document.querySelectorAll('[id^="' + prefix + '-"]');
      var t = 0, c = 0;
      allInPrefix.forEach(function(x) { if (x.id.indexOf('selall-') !== 0) { t++; if (x.checked) c++; } });
      selAll.checked = (c === t && t > 0);
      selAll.indeterminate = (c > 0 && c < t);
    }
  }

  function onInstallCheck(cb, phaseId, checkId) {
    Store.setSOPCheckState(null, 'install', checkId, cb.checked, '');
    const phase = (Store.getInstallSOP().phases||[]).find(p=>p.id===phaseId);
    if (phase){
      const el=document.getElementById(`phase-pct-${phaseId}`);
      if(el) el.textContent=calcPhasePct(phase);
      const selAll = document.getElementById('selall-'+phaseId);
      if (selAll) {
        const allChecks = phase.checks.map(ch => document.getElementById(ch.id));
        const total = allChecks.length;
        const checked = allChecks.filter(c => c && c.checked).length;
        selAll.checked = (checked === total && total > 0);
        selAll.indeterminate = (checked > 0 && checked < total);
      }
    }
    updateOverallInstallProgress();
  }

  function onInstallNote(input, phaseId, checkId) {
    Store.setSOPCheckState(null,'install',checkId,input.value==='true'||input.dataset.checked==='true',input.value);
  }

  function toggleInstallSelectAll(cb, phaseId) {
    const phase = (Store.getInstallSOP().phases||[]).find(p=>p.id===phaseId);
    if (!phase) return;
    const checked = cb.checked;
    phase.checks.forEach(function(ch) {
      var c = document.getElementById(ch.id);
      if (c) { c.checked = checked; Store.setSOPCheckState(null, 'install', ch.id, checked, ''); }
    });
    const pctEl = document.getElementById('phase-pct-'+phaseId);
    if (pctEl) pctEl.textContent = calcPhasePct(phase);
    cb.indeterminate = false;
    updateOverallInstallProgress();
  }

  function onSATCheck(cb, phaseId, checkId) {
    Store.setSOPCheckState(null, 'sat', checkId, cb.checked, '');
    const phase = (Store.getSatSOP().phases||[]).find(p=>p.id===phaseId);
    if (phase){
      const el=document.getElementById(`phase-pct-${phaseId}`);
      if(el) el.textContent=calcSATPhasePct(phase);
      const selAll = document.getElementById('selall-'+phaseId);
      if (selAll) {
        const allChecks = phase.checks.map(ch => document.getElementById(ch.id));
        const total = allChecks.length;
        const checked = allChecks.filter(c => c && c.checked).length;
        selAll.checked = (checked === total && total > 0);
        selAll.indeterminate = (checked > 0 && checked < total);
      }
    }
    updateOverallSATProgress();
  }

  function onSATNote(input, phaseId, checkId) {
    Store.setSOPCheckState(null,'sat',checkId,input.dataset.checked==='true',input.value);
  }

  function toggleSATSelectAll(cb, phaseId) {
    const phase = (Store.getSatSOP().phases||[]).find(p=>p.id===phaseId);
    if (!phase) return;
    const checked = cb.checked;
    phase.checks.forEach(function(ch) {
      var c = document.getElementById(ch.id);
      if (c) { c.checked = checked; Store.setSOPCheckState(null, 'sat', ch.id, checked, ''); }
    });
    const pctEl = document.getElementById('phase-pct-'+phaseId);
    if (pctEl) pctEl.textContent = calcSATPhasePct(phase);
    cb.indeterminate = false;
    updateOverallSATProgress();
  }

  function onFATCheck(cb) {
    // 更新当前phase的完成百分比
    var checkId = cb.id;
    // 找到所属的phase（通过查找最近的table或已知phaseId）
    var phaseId = null;
    if (checkId.indexOf('fat-0') === 0) phaseId = 'fat-0';
    else if (checkId.indexOf('fat-1') === 0) phaseId = 'fat-1';
    else if (checkId.indexOf('fat-2') === 0) phaseId = 'fat-2';
    else if (checkId.indexOf('fat-3') === 0) phaseId = 'fat-3';
    else if (checkId.indexOf('fat-4') === 0) phaseId = 'fat-4';
    else if (checkId.indexOf('fat-5') === 0) phaseId = 'fat-5';
    else if (checkId.indexOf('fat-6') === 0) phaseId = 'fat-6';
    else if (checkId.indexOf('fat-7') === 0) phaseId = 'fat-7';
    else if (checkId.indexOf('fat-8') === 0) phaseId = 'fat-8';
    else if (checkId.indexOf('fat-9') === 0) phaseId = 'fat-9';
    
    if (phaseId) {
      var pctEl = document.getElementById('phase-pct-' + phaseId);
      if (pctEl) {
        var table = pctEl.closest('.card-body');
        if (table) {
          var allCbs = table.querySelectorAll('tbody input[type="checkbox"]');
          var total = allCbs.length;
          var checked = 0;
          allCbs.forEach(function(c) { if (c.checked) checked++; });
          var pct = total > 0 ? Math.round(checked / total * 100) : 0;
          pctEl.textContent = pct + '%';
        }
      }
    }
    // 更新MFG总进度
    if (typeof updateMFGOverallProgress === 'function') updateMFGOverallProgress();
  }

  function calcPhasePct(phase) {
    const checked = phase.checks.filter(ch=>{const el=document.getElementById(ch.id);return el&&el.checked;}).length;
    const pct = phase.checks.length>0?Math.round(checked/phase.checks.length*100):0;
    return `${checked}/${phase.checks.length} (${pct}%)`;
  }

  function calcSATPhasePct(phase) {
    const checked = phase.checks.filter(ch=>{const el=document.getElementById(ch.id);return el&&el.checked;}).length;
    const pct = phase.checks.length>0?Math.round(checked/phase.checks.length*100):0;
    return `${checked}/${phase.checks.length} (${pct}%)`;
  }

  function updateOverallInstallProgress() {
    const sop = Store.getInstallSOP();
    const allChecks=(sop.phases||[]).flatMap(p=>p.checks);
    const checked=allChecks.filter(ch=>{const el=document.getElementById(ch.id);return el&&el.checked;}).length;
    const pct=allChecks.length>0?Math.round(checked/allChecks.length*100):0;
    Store.setPhaseProgress(null,'5_install',pct);
  }

  function updateOverallSATProgress() {
    const sop = Store.getSatSOP();
    const allChecks=(sop.phases||[]).flatMap(p=>p.checks);
    const checked=allChecks.filter(ch=>{const el=document.getElementById(ch.id);return el&&el.checked;}).length;
    const pct=allChecks.length>0?Math.round(checked/allChecks.length*100):0;
    Store.setPhaseProgress(null,'6_commission',pct);
  }

  function isInstallChecked(checkId) { const s=Store.getSOPCheckState(null,'install',checkId);return s?.passed||false; }
  function getInstallNote(checkId) { const s=Store.getSOPCheckState(null,'install',checkId);return s?.notes||''; }
  function isSATChecked(checkId) { const s=Store.getSOPCheckState(null,'sat',checkId);return s?.passed||false; }
  function getSATNote(checkId) { const s=Store.getSOPCheckState(null,'sat',checkId);return s?.notes||''; }

  function getPhaseKeyByPrefix(prefix) {
    // 多级匹配：先精确匹配，再按首段匹配（修复Tab2-8全部错误映射到Tab1的P0 Bug）
    const map={rnd:'1_rnd',bd:'2_bd',mfg:'3_mfg',log:'4_logistics',ins:'5_install',sat:'6_commission',ho:'7_handover',af:'8_aftersales',ops:'9_ops'};
    if (map[prefix]) return map[prefix];
    const seg = prefix.split('-')[0]; // 'bd-bd-public' → 'bd', 'mfg-ord' → 'mfg'
    return map[seg] || '1_rnd';
  }

  // ========== 子Tab切换（修复核心bug + 风险联动）==========
  function bindSubTabEvents() {
    document.querySelectorAll('.sub-tab-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const group = this.dataset.tabGroup;
        const subtabId = this.dataset.subtab;
        // 同组按钮切换active
        document.querySelectorAll(`.sub-tab-btn[data-tab-group="${group}"]`).forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        // 在当前tab内容区域内查找对应面板
        const tabContent = this.closest('.tab-content.active') || document.querySelector('.tab-content.active');
        if (!tabContent) return;
        tabContent.querySelectorAll('.sub-tab-panel').forEach(panel => panel.classList.remove('active'));
        const targetPanel = tabContent.querySelector(`.sub-tab-panel[data-panel="${subtabId}"]`);
        if (targetPanel) targetPanel.classList.add('active');
        // 兼容旧模式：查找subTab-xxx格式ID的面板
        if (!targetPanel) {
          const legacyTarget = tabContent.querySelector('[id^="subTab-"]');
          if (legacyTarget) {
            tabContent.querySelectorAll('[id^="subTab-"]').forEach(el => el.classList.remove('active'));
            legacyTarget.classList.add('active');
          }
        }
        // Tab5/Tab6/Tab4 子标签切换时联动刷新风险卡片和效率卡片
        if (group === 'install') {
          refreshInstallRiskCard(subtabId);
          refreshInstallEfficiencyCard(subtabId);
        }
        else if (group === 'commission') {
          refreshCommissionRiskCard(subtabId);
          refreshCommissionEfficiencyCard(subtabId);
        }
        else if (group === 'log') {
          refreshLogisticsRiskCard(subtabId);
        }
        else if (group === 'mfg') {
          refreshMfgRiskCard(subtabId);
        }
      });
    });
    // ★ 初始化各页面的"全部完成/合格"按钮状态
    if (typeof initFATAllPassedState === 'function') initFATAllPassedState();
    if (typeof initInstallAllCompletedState === 'function') initInstallAllCompletedState();
    if (typeof initSATAllPassedState === 'function') initSATAllPassedState();
  }

  // ========== 全局操作 ==========
  function saveAll() { Store.persist(); toast('所有数据已保存','success'); }
  function resetCurrent() { if(!confirm('确定要重置当前项目所有数据到默认状态吗？此操作不可恢复。'))return; Store.resetProject(); renderProgressAxis();switchTab(currentTab);renderFoldableCards();toast('已重置为默认数据','info'); }
  function exportCSV() {
    const p = Store.getSelectedProject(); if(!p){toast('暂无项目数据，请先选择项目','error');return;}
    let csv='阶段,完成度(%),备注\n';PHASE_DEFS.forEach(def=>{const comp=p.phases[def.key]?.completed||0;const notes=p.phases[def.key]?.notes||'';csv+=`"${def.name}",${comp},"${notes}"\n`;});
    downloadFile(`ESS交付进度_${p.name}_${new Date().toISOString().slice(0,10)}.csv`,csv,'text/csv;charset=utf-8');toast('CSV导出完成','success');
  }
  // ========== PDF导出（html2canvas + jsPDF）==========
  function downloadPDF() {
    // 检查依赖库是否加载
    if (typeof html2canvas === 'undefined' || typeof jspdf === 'undefined') {
      toast('PDF导出库未加载，请检查网络连接后刷新页面重试', 'error');
      return;
    }
    var { jsPDF } = jspdf;
    if (!jsPDF) {
      toast('PDF导出库版本不兼容，请刷新页面重试', 'error');
      return;
    }

    toast('正在生成PDF，请稍候...', 'info');

    // 获取项目名称用于文件名
    var projName = 'ESS交付报告';
    try {
      var sel = document.getElementById('projectSelect');
      if (sel && sel.options[sel.selectedIndex]) {
        projName = sel.options[sel.selectedIndex].text || projName;
      }
    } catch(e) {}

    // 要捕获的区域：从headerBar到foldableSection（不含action-bar和footer）
    var captureEl = document.getElementById('headerBar') ? document.body : null;

    // 使用html2canvas渲染
    var opts = {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#f8fafc',
      logging: false,
      width: captureEl ? captureEl.scrollWidth : window.innerWidth,
      windowWidth: captureEl ? captureEl.scrollWidth : window.innerWidth,
      height: captureEl ? captureEl.scrollHeight : document.body.scrollHeight,
      windowHeight: captureEl ? captureEl.scrollHeight : document.body.scrollHeight
    };

    html2canvas(captureEl, opts).then(function(canvas) {
      var imgData = canvas.toDataURL('image/jpeg', 0.95);
      var imgWidth = canvas.width;
      var imgHeight = canvas.height;

      // A4纸尺寸（mm），jsPDF默认单位mm
      var a4w = 210; var a4h = 297;
      var margin = 10; // 左右边距
      var contentW = a4w - margin * 2;
      // 计算图片在PDF中的高度（保持宽高比）
      var ratio = contentW / (imgWidth / opts.scale);
      var contentH = (imgHeight / opts.scale) * ratio;

      var pdf = new jsPDF('p', 'mm', 'a4');

      if (contentH <= a4h - margin * 2) {
        // 单页
        pdf.addImage(imgData, 'JPEG', margin, margin, contentW, contentH);
      } else {
        // 多页：按A4高度分页
        var remainingH = contentH;
        var position = margin;
        var pageH = a4h - margin * 2; // 每页可用内容高度
        var srcY = 0; // 从源图像的哪个y位置开始截取
        var srcPageH = 0; // 每页截取的源像素高度

        while (remainingH > 0) {
          if (position > margin) pdf.addPage();
          // 计算本页应显示的高度
          var showH = Math.min(remainingH, pageH);
          // 计算对应的源图像区域比例
          var srcRatio = showH / contentH;
          srcPageH = imgHeight * srcRatio;

          // 将整图添加但通过viewport裁剪效果——简化方案：每页绘制对应区域
          // 由于addImage不支持src裁取，改用分块策略：创建临时canvas截取对应区域
          var pageCanvas = document.createElement('canvas');
          pageCanvas.width = imgWidth;
          pageCanvas.height = srcPageH;
          var pctx = pageCanvas.getContext('2d');
          // 白色背景
          pctx.fillStyle = '#ffffff';
          pctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
          pctx.drawImage(canvas,
            0, srcY, imgWidth, srcPageH,  // 源区域
            0, 0, pageCanvas.width, pageCanvas.height  // 目标区域
          );
          var pageImgData = pageCanvas.toDataURL('image/jpeg', 0.95);

          pdf.addImage(pageImgData, 'JPEG', margin, margin, contentW, showH);

          srcY += srcPageH;
          remainingH -= showH;
          position += showH + margin;
        }
      }

      // 页脚：生成时间
      var totalPages = pdf.internal.getNumberOfPages();
      for (var i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(150);
        pdf.text(
          projName + ' | 第 ' + i + '/' + totalPages + ' 页 | ' + new Date().toLocaleString('zh-CN'),
          a4w / 2, a4h - 5, { align: 'center' }
        );
      }

      pdf.save(projName + '_' + new Date().toISOString().slice(0,10) + '.pdf');
      toast('PDF导出成功！共 ' + totalPages + ' 页', 'success');
    }).catch(function(err) {
      console.error('PDF导出失败:', err);
      toast('PDF导出失败: ' + (err.message || '未知错误'), 'error');
    });
  }

  function downloadFile(filename, content, mimeType) {
    const blob=new Blob(['\uFEFF'+content],{type:mimeType});const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
  }

  // ========== 弹窗 ==========
  function showImportCSVModal() {
    showModal('导入项目(CSV)','<p class="text-sm text-muted mb-2">CSV格式: 项目名称,容量(MW/MWh),电池技术,柜数,柜型号,地址,合同性质,状态</p><textarea id="csvInput" class="inline-input" rows="6" placeholder="粘贴CSV内容或选择文件..."></textarea><input type="file" id="csvFileInput" accept=".csv" onchange="App.handleCSVFile(this)" class="mt-1" style="font-size:12px;">',
      [{text:'导入',cls:'btn-primary',action:function(){const csv=document.getElementById('csvInput').value;if(!csv.trim()){toast('请输入CSV数据','error');return;}const r=Store.importProjectsFromCSV(csv);if(r.success){toast(r.message,'success');App.refreshAll();App.closeModal()}else toast(r.message,'error');}},
       {text:'取消',cls:'',action:closeModal}]
    );
  }
  function showAddProjectModal() {
    showModal('新增项目','<table class="delivery-table"><tr><td>项目名称</td><td><input class="inline-input" id="newProjName" placeholder="例：XX储能项目"></td></tr><tr><td>容量</td><td><input class="inline-input" id="newProjCap" placeholder="例：100MW/200MWh"></td></tr><tr><td>电池技术</td><td><select class="inline-input" id="newProjTech"><option>LFP</option><option>钒流</option><option>钠流</option></select></td></tr><tr><td>柜数</td><td><input class="inline-input" id="newProjCab" placeholder="例：40"></td></tr><tr><td>柜型号</td><td><input class="inline-input" id="newProjModel" placeholder="例：ArcBank1.0-5.016MWh"></td></tr><tr><td>地址</td><td><input class="inline-input" id="newProjLoc" placeholder="例：印度新德里"></td></tr><tr><td>合同性质</td><td><select class="inline-input" id="newProjContract"><option>EPC</option><option>PPP</option><option>BOO</option></select></td></tr><tr><td>状态</td><td><select class="inline-input" id="newProjStatus"><option>计划交付</option><option>交付中</option></select></td></tr></table>',
      [{text:'确认新增',cls:'btn-primary',action:function(){const proj=Store.addProject({name:document.getElementById('newProjName').value,capacity:document.getElementById('newProjCap').value,batteryTech:document.getElementById('newProjTech').value,cabinetCount:document.getElementById('newProjCab').value,cabinetModel:document.getElementById('newProjModel').value,location:document.getElementById('newProjLoc').value,contractType:document.getElementById('newProjContract').value,status:document.getElementById('newProjStatus').value});toast('项目已添加','success');App.refreshAll();App.closeModal();}},
       {text:'取消',cls:'',action:closeModal}]
    );
  }
  function handleCSVFile(input){const f=input.files[0];if(!f)return;const r=new FileReader();r.onload=e=>{document.getElementById('csvInput').value=e.target.result};r.readAsText(f);}
  function showModal(title,bodyHTML,buttons){
    document.getElementById('modalContainer').innerHTML=`<div class="modal-overlay" onclick="if(event.target===this)App.closeModal()"><div class="modal-box"><h3>${title}</h3>${bodyHTML}<div class="modal-actions">${buttons.map(b=>`<button class="btn ${b.cls}" onclick="(${b.action.toString()})()">${b.text}</button>`).join('')}</div></div></div>`;
  }
  function closeModal(){document.getElementById('modalContainer').innerHTML='';}

  // ========== Toast ==========
  function toast(msg,type){
    const c=document.getElementById('toastContainer');const el=document.createElement('div');el.className=`toast toast-${type||'info'}`;el.textContent=msg;c.appendChild(el);setTimeout(()=>{el.style.opacity='0';el.style.transition='opacity 0.3s';setTimeout(()=>el.remove(),300);},2500);
  }

  // ========== 质保倒计时 ==========
  function onWarrantyMonthSelect(sel){
    var val = sel.value;
    var mi = document.getElementById('warrantyMonths');
    if(val && mi){
      mi.value = val;
      updateWarranty();
    }
    // 如果选择"自定义..."，清空让用户手动输入
    if(!val){ mi.focus(); mi.select(); }
  }
  function updateWarranty(){
    const si=document.getElementById('warrantyStartInput'),mi=document.getElementById('warrantyMonths');
    const sel=document.getElementById('warrantyMonthsSelect');
    // 同步select值
    if(sel&&mi){
      var v=parseInt(mi.value)||24;
      var found=false;
      for(var i=0;i<sel.options.length;i++){
        if(parseInt(sel.options[i].value)===v){sel.selectedIndex=i;found=true;break;}
      }
      if(!found)sel.selectedIndex=0; // 自定义
    }
    if(!si||!mi)return;
    const start=si.value,months=parseInt(mi.value)||24;
    document.getElementById('warrantyStart').textContent=start||'待定';
    if(start){const ed=new Date(start);ed.setMonth(ed.getMonth()+months);const es=ed.toISOString().slice(0,10);
      document.getElementById('warrantyEnd').textContent=es;
      const now=new Date(),diff=Math.ceil((ed-now)/86400000),el=document.getElementById('warrantyCountdown');
      if(diff>90){el.textContent=`剩余 ${diff} 天`;el.className='warranty-countdown active';}
      else if(diff>0){el.textContent=`剩余 ${diff} 天`;el.className='warranty-countdown warning';}
      else{el.textContent='已到期';el.className='warranty-countdown expired';}
    }
  }

  // ========== 事件回调 ==========
  function onProjectChanged(){updateProjectParams();}
  function onProgressChanged(){renderProgressAxis();renderFoldableCards();}
  function onDataChanged(){renderFoldableCards();}
  function refreshAll(){renderProjectSelector();updateProjectParams();renderProgressAxis();renderTabNav();switchTab(currentTab);renderFoldableCards();}

  // ========= 折叠卡片切换 =========
  function toggleCardFold(headerEl) {
    var card = headerEl.closest('.card-foldable');
    if (card) card.classList.toggle('open');
  }

  // ========= IQC 全选 =========
  function toggleIQCSelectAll(cb) {
    var checked = cb.checked;
    document.querySelectorAll('.iqc-checkbox').forEach(function(c){ c.checked = checked; });
  }

  // ========= QC 全选 =========
  function toggleQCSelectAll(cb) {
    var checked = cb.checked;
    document.querySelectorAll('.qc-checkbox').forEach(function(c){ c.checked = checked; });
  }

  // ========= 批次 全选 =========
  function toggleBatchSelectAll(cb) {
    var checked = cb.checked;
    document.querySelectorAll('.batch-checkbox').forEach(function(c){ c.checked = checked; });
  }

  // ========= 安全要求 全选 =========
  function toggleSafetySelectAll(cb) {
    var checked = cb.checked;
    document.querySelectorAll('.safety-checkbox').forEach(function(c){ c.checked = checked; });
  }

  // ========= 安全要求 增删 =========
  // 固定安全要求条数（前11条不可删除）
  var FIXED_SAFETY_COUNT = 11;
  var FIXED_SAFETY_ITEMS = [
    '作业人员佩戴安全帽、绝缘手套/劳保鞋',
    '高处作业安全带',
    '基坑围护良好并张贴警示',
    '吊装区域设警戒线并张贴警示',
    '风速>6级停止作业',
    '消防通道畅通',
    '灭火设备可用',
    '验电确认无电操作',
    '防雷接地与保护接地分开',
    '压力试验时人员防护并设警戒',
    '执行监管方其它相关要求'
  ];
  function getSafetyItems() {
    // 从localStorage读取自定义safety项，固定11条始终保留
    var saved = null;
    try { saved = JSON.parse(localStorage.getItem('ess_safety_items')); } catch(e) {}
    if (!saved || !Array.isArray(saved) || saved.length === 0) return FIXED_SAFETY_ITEMS.slice();
    // 迁移：若旧数据不足11条，补全固定项
    var result = [];
    var fixedSet = new Set(FIXED_SAFETY_ITEMS);
    // 先保留固定项（按固定顺序）
    FIXED_SAFETY_ITEMS.forEach(function(f) {
      if (saved.indexOf(f) >= 0 || result.indexOf(f) < 0) result.push(f);
    });
    // 再追加非固定项的自定义项
    saved.forEach(function(s) {
      if (FIXED_SAFETY_ITEMS.indexOf(s) < 0 && result.indexOf(s) < 0) result.push(s);
    });
    return result;
  }
  function addSafetyItem() {
    var input = document.getElementById('newSafetyInput');
    if (!input || !input.value.trim()) { toast('请输入安全要求内容','warn'); return; }
    var items = getSafetyItems();
    // 只保存自定义项（固定11条不算自定义）
    var custom = items.filter(function(s) { return FIXED_SAFETY_ITEMS.indexOf(s) < 0; });
    custom.push(input.value.trim());
    // localStorage只存自定义项
    localStorage.setItem('ess_safety_custom_items', JSON.stringify(custom));
    // 同时更新完整列表（兼容旧版读取）
    localStorage.setItem('ess_safety_items', JSON.stringify(getSafetyItems()));
    input.value = '';
    toast('已添加安全要求项','success');
    switchTab(currentTab);
  }
  function removeSafetyItem(index) {
    var items = getSafetyItems();
    if (index < FIXED_SAFETY_COUNT) { toast('固定项不可删除','warn'); return; }
    items.splice(index, 1);
    // 只保存自定义项
    var custom = items.filter(function(s) { return FIXED_SAFETY_ITEMS.indexOf(s) < 0; });
    localStorage.setItem('ess_safety_custom_items', JSON.stringify(custom));
    localStorage.setItem('ess_safety_items', JSON.stringify(items));
    toast('已删除安全要求项','info');
    switchTab(currentTab);
  }

  // ========= 子标签切换时刷新风险卡片 =========
  function refreshRiskForSubTab(tabId) {
    // Tab5安装子标签切换后刷新风险
    if (tabId === '5_install' || tabId === '6_commission') {
      switchTab(tabId);
    }
  }

  // ========= 5M1E 全选 =========
  function toggleM5ESelectAll(cb) {
    var checked = cb.checked;
    document.querySelectorAll('.m5e-checkbox').forEach(function(c){ c.checked = checked; });
  }

  // ========== 计划vs实际对比图绘制函数 ==========
  function drawMfgChart() {
    var p = Store.getSelectedProject();
    var data = window.ProgressChart ? ProgressChart.getMfgData(p) : null;
    if (data) {
      ProgressChart.render('mfgChart', data);
      var advice = document.getElementById('mfgChartAdvice');
      if (advice) {
        var txt = '';
        if (p.status === '已交付') txt = '✅ 项目已交付，所有生产批次均已完成。';
        else if (p.status === '计划交付') txt = '📋 项目计划中，生产制造尚未开始。';
        else {
          var comp = p.phases && p.phases['3_mfg'] ? p.phases['3_mfg'].completed : 0;
          if (comp >= 80) txt = '✅ 生产进度良好，首批已接近完工，建议提前安排FAT和物流。';
          else if (comp >= 30) txt = '⚡ 首批生产中，建议密切关注FAT排期，避免瓶颈。';
          else txt = '⚠ 生产刚启动，请确认原材料到位情况和排产计划。';
        }
        advice.innerHTML = txt;
      }
    }
  }
  function drawInstallChart() {
    var p = Store.getSelectedProject();
    var data = window.ProgressChart ? ProgressChart.getInstallData(p) : null;
    if (data) {
      ProgressChart.render('installChart', data);
      var advice = document.getElementById('installChartAdvice');
      if (advice) {
        var txt = '';
        if (p.status === '已交付') txt = '✅ 现场安装已全部完成。';
        else if (p.status === '计划交付') txt = '📋 项目计划中，现场安装尚未开始。';
        else txt = '⚡ 安装进行中，请按工序逐一确认验收。';
        advice.innerHTML = txt;
      }
    }
  }
  function drawSATChart() {
    var p = Store.getSelectedProject();
    var data = window.ProgressChart ? ProgressChart.getSATData(p) : null;
    if (data) {
      ProgressChart.render('satChart', data);
      var advice = document.getElementById('satChartAdvice');
      if (advice) {
        var txt = '';
        if (p.status === '已交付') txt = '✅ 系统调试已全部完成，并网运行正常。';
        else if (p.status === '计划交付') txt = '📋 项目计划中，系统调试尚未开始。';
        else txt = '⚡ 调试进行中，请重点关注并网试验和72h试运行。';
        advice.innerHTML = txt;
      }
    }
  }
  function drawLogisticsChart() {
    var p = Store.getSelectedProject();
    var data = window.ProgressChart ? ProgressChart.getLogisticsData(p) : null;
    if (data) {
      ProgressChart.render('logisticsChart', data);
      var advice = document.getElementById('logisticsChartAdvice');
      if (advice) {
        var txt = '';
        if (p.status === '已交付') txt = '✅ 所有批次已全部到货，物流运输完成。';
        else if (p.status === '计划交付') txt = '📋 项目计划中，物流运输尚未开始。';
        else txt = '⚡ 物流进行中，请密切关注海运时效和清关进度。';
        advice.innerHTML = txt;
      }
    }
  }

  // ========= 暴露API =========
  return {
    init,selectProject,switchTab,toggleFoldable,
    toggleCardFold,toggleIQCSelectAll,toggleQCSelectAll,toggleBatchSelectAll,toggleSafetySelectAll,toggleM5ESelectAll,
    addSafetyItem,removeSafetyItem,
    addCustomCheck,removeCustomCheck,
    switchFatPhase,toggleFATSelectAll,toggleFATAllPassed,initFATAllPassedState,
    switchRdPhase,toggleRDSelectAll,onRDCheck,initRDCheckState,updateRndOverallProgress,toggleRDAllCompleted,initRDAllCompletedState,
    toggleInstallAllCompleted,initInstallAllCompletedState,updateInstallOverallProgress,
    toggleSATAllPassed,initSATAllPassedState,updateSATOverallProgress,
    toggleMfgAllCompleted,initMfgAllCompletedState,
    refreshInstallRiskCard,refreshCommissionRiskCard,refreshMfgRiskCard,
    onProgressCheck, toggleSelectAll,
    onInstallCheck,onInstallNote,toggleInstallSelectAll,onSATCheck,onSATNote,toggleSATSelectAll,onFATCheck,
    saveAll,resetCurrent,exportCSV,downloadPDF,
    showImportCSVModal,showAddProjectModal,handleCSVFile,closeModal,
    updateWarranty,refreshAll,
    onWarrantyMonthSelect,
    openSatisfactionSurvey,viewSurveyStatistics,exportSurveyCSV,selectScore,submitSurvey,loadQuickStats,bindSurveyEvents,
    handleSurveyClose,renderSurveyRiskDashboard,openContactEmail,
    buildSurveyEmailBody,downloadSurveyCSV,
    sendEmailViaAPI,fallbackMailto,uploadCSVToCloud,checkBackendAvailable,
    updateProjectParams,renderDeliveryOverview,
    openTrainingSystem,showTrainingModule,addTrainingPlan,delTrainingPlan,uploadMaterial,addMaterialMeta,downloadMaterial,delMaterial,startExam,submitExam,shareExam,copyText,copyShare,importResult,queryScore,submitTrainingFeedback,
    drawMfgChart,drawInstallChart,drawSATChart,drawLogisticsChart,
    toast
  };
})();
