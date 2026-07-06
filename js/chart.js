// 计划vs实际进度对比图 - Canvas绘制引擎
// 为ESS交付管理系统v1.9新增功能

var ProgressChart = (function() {
  // 通用绘制函数
  function render(canvasId, config) {
    var canvas = document.getElementById(canvasId);
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var W = canvas.width = canvas.parentElement ? Math.max(300, canvas.parentElement.offsetWidth - 20) : 400;
    var H = canvas.height = 230;
    ctx.clearRect(0, 0, W, H);

    var planned = config.planned || [];
    var actual  = config.actual  || [];
    var title   = config.title || '计划 vs 实际进度对比';
    var warnings = config.warnings || [];
    var unit    = config.unit || '%';

    // 布局
    var padL = 65, padR = 30, padT = 42, padB = 55;
    var chartW = W - padL - padR;
    var chartH = H - padT - padB;

    // 背景
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, W, H);

    // 标题
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 13px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, W / 2, 24);

    // 无数据
    var labels = (planned.length > 0 ? planned : actual).map(function(p) { return p.label; });
    var n = labels.length;
    if (n === 0) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px sans-serif';
      ctx.fillText('暂无数据', W / 2, H / 2);
      return;
    }

    var barW = chartW / n;

    // Y轴网格 + 刻度
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    for (var i = 0; i <= 5; i++) {
      var y = padT + chartH - (chartH * i / 5);
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
      ctx.fillText((20 * i) + unit, padL - 6, y + 4);
    }

    // X轴标签
    ctx.textAlign = 'center';
    ctx.fillStyle = '#475569';
    ctx.font = '10px sans-serif';
    labels.forEach(function(lbl, i) {
      var x = padL + barW * i + barW / 2;
      ctx.save();
      ctx.translate(x + 8, H - padB + 12);
      ctx.rotate(-0.35);
      ctx.fillText(lbl, 0, 0);
      ctx.restore();
    });

    // 计划柱（蓝色，空心）
    planned.forEach(function(p, i) {
      var x = padL + barW * i + barW * 0.15;
      var w = barW * 0.32;
      var h = chartH * Math.min(1, p.value / 100);
      var y = padT + chartH - h;
      ctx.fillStyle = 'rgba(59,130,246,0.13)';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x, y, w, h);
      if (p.value > 0) {
        ctx.fillStyle = '#1d4ed8';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(p.value + unit, x + w / 2, y - 5);
      }
    });

    // 实际柱（绿色，滞后时红色）
    actual.forEach(function(p, i) {
      var x = padL + barW * i + barW * 0.53;
      var w = barW * 0.32;
      var plannedVal = planned[i] ? planned[i].value : 0;
      var isLate = plannedVal > 0 && p.value < plannedVal - 8;
      var h = chartH * Math.min(1, p.value / 100);
      var y = padT + chartH - h;
      ctx.fillStyle = isLate ? 'rgba(239,68,68,0.18)' : 'rgba(34,197,94,0.18)';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = isLate ? '#ef4444' : '#22c55e';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x, y, w, h);
      if (p.value > 0) {
        ctx.fillStyle = isLate ? '#dc2626' : '#16a34a';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(p.value + unit, x + w / 2, y - 5);
      }
      if (isLate) {
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 13px sans-serif';
        ctx.fillText('↓', x + w / 2, y - 18);
      }
    });

    // 图例
    var ly = H - 32;
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(padL, ly - 5, 12, 10);
    ctx.fillStyle = '#334155';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('计划', padL + 16, ly + 3);
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(padL + 55, ly - 5, 12, 10);
    ctx.fillStyle = '#334155';
    ctx.fillText('实际', padL + 74, ly + 3);
    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('↓滞后', padL + 120, ly + 3);

    // 预警信息（右上角）
    if (warnings.length > 0) {
      var wy = padT + 8;
      warnings.forEach(function(w) {
        ctx.fillStyle = w.level === 'high' ? '#dc2626' : (w.level === 'medium' ? '#d97706' : '#2563eb');
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText('⚠ ' + w.text, W - padR, wy);
        wy += 16;
      });
    }
  }

  // 生产制造对比数据
  function getMfgData(project) {
    if (!project) return { planned: [], actual: [] };
    var isDelivered = project.status === '已交付';
    var isPlanned = project.status === '计划交付';
    var mfgComp = project.phases && project.phases['3_mfg'] ? project.phases['3_mfg'].completed : 0;
    var batches = [
      { label: '批次1(16柜)', pv: isDelivered ? 100 : (isPlanned ? 0 : 35), av: isDelivered ? 100 : (isPlanned ? 0 : Math.min(100, mfgComp * 3.3)) },
      { label: '批次2(16柜)', pv: isDelivered ? 100 : (isPlanned ? 0 : 5), av: isDelivered ? 100 : (isPlanned ? 0 : Math.max(0, (mfgComp - 30) * 3.3)) },
      { label: 'FAT验收', pv: isDelivered ? 100 : (isPlanned ? 0 : 0), av: isDelivered ? 100 : (isPlanned ? 0 : (mfgComp >= 80 ? (mfgComp - 60) * 3 : 0)) },
      { label: '包装发货', pv: isDelivered ? 100 : (isPlanned ? 0 : 0), av: isDelivered ? 100 : (isPlanned ? 0 : (mfgComp >= 90 ? (mfgComp - 80) * 5 : 0)) }
    ];
    var warnings = [];
    batches.forEach(function(b) {
      if (b.pv > 0 && b.av < b.pv - 15) warnings.push({ text: b.label + '滞后' + (b.pv - b.av) + '%', level: 'high' });
    });
    return {
      title: '生产制造 · 分批次计划 vs 实际进度',
      planned: batches.map(function(b) { return { label: b.label, value: Math.max(0, Math.min(100, b.pv)) }; }),
      actual: batches.map(function(b) { return { label: b.label, value: Math.max(0, Math.min(100, Math.round(b.av))) }; }),
      warnings: warnings
    };
  }

  // 现场安装对比数据
  function getInstallData(project) {
    if (!project) return { planned: [], actual: [] };
    var isDelivered = project.status === '已交付';
    var isPlanned = project.status === '计划交付';
    var phases = ['地基施工', '预制舱吊装', '电气连接', '液冷管道', '消防系统', '接地系统', '围栏安防'];
    var phaseKeys = ['ins-1', 'ins-2', 'ins-3', 'ins-4', 'ins-5', 'ins-6', 'ins-7'];
    var warnings = [];
    var result = {
      planned: phases.map(function(ph) { return { label: ph, value: isDelivered ? 100 : (isPlanned ? 0 : 50) }; }),
      actual: phaseKeys.map(function(key, i) {
        var val = isDelivered ? 100 : (isPlanned ? 0 : Math.max(0, 50 - i * 7));
        // 从Store读取实际勾选进度
        var sop = window.Store ? Store.getInstallSOP() : null;
        if (sop && sop.phases) {
          var pd = sop.phases.find(function(p) { return p.id === key; });
          if (pd && pd.checks) {
            var total = pd.checks.length, passed = 0;
            pd.checks.forEach(function(ch) {
              var st = Store.getSOPCheckState(null, 'install', ch.id);
              if (st && st.passed) passed++;
            });
            if (total > 0) val = Math.round(passed / total * 100);
          }
        }
        if (!isDelivered && !isPlanned && val < 30) warnings.push({ text: phases[i] + '进度滞后', level: 'medium' });
        return { label: phases[i], value: val };
      })
    };
    result.warnings = warnings;
    result.title = '现场安装 · 各工序计划 vs 实际进度';
    return result;
  }

  // 系统调试对比数据
  function getSATData(project) {
    if (!project) return { planned: [], actual: [] };
    var isDelivered = project.status === '已交付';
    var isPlanned = project.status === '计划交付';
    var phases = ['调试准备', '外观线束', '绝缘检测', '软件配置', '低压调试', '高压调试', '充放电', '并网联动', 'SAT验收', '型式备查'];
    var phaseKeys = ['sat-1', 'sat-2', 'sat-3', 'sat-4', 'sat-5', 'sat-6', 'sat-7', 'sat-8', 'sat-9', 'sat-10'];
    var warnings = [];
    var result = {
      planned: phases.map(function(ph) { return { label: ph, value: isDelivered ? 100 : (isPlanned ? 0 : 50) }; }),
      actual: phaseKeys.map(function(key, i) {
        var val = isDelivered ? 100 : (isPlanned ? 0 : Math.max(0, 50 - i * 5));
        var sop = window.Store ? Store.getSatSOP() : null;
        if (sop && sop.phases) {
          var pd = sop.phases.find(function(p) { return p.id === key; });
          if (pd && pd.checks) {
            var total = pd.checks.length, passed = 0;
            pd.checks.forEach(function(ch) {
              var st = Store.getSOPCheckState(null, 'sat', ch.id);
              if (st && st.passed) passed++;
            });
            if (total > 0) val = Math.round(passed / total * 100);
          }
        }
        if (!isDelivered && !isPlanned && val < 20) warnings.push({ text: phases[i] + '未完成', level: 'medium' });
        return { label: phases[i], value: val };
      })
    };
    result.warnings = warnings;
    result.title = '系统调试 · 各阶段计划 vs 实际进度';
    return result;
  }

  // 物流运输对比数据
  function getLogisticsData(project) {
    if (!project) return { planned: [], actual: [] };
    var isDelivered = project.status === '已交付';
    var isPlanned = project.status === '计划交付';
    var batches = [
      { label: '批次1生产完', pv: isDelivered ? 100 : (isPlanned ? 0 : 70) },
      { label: '批次1发货', pv: isDelivered ? 100 : (isPlanned ? 0 : 50) },
      { label: '海运途中', pv: isDelivered ? 100 : (isPlanned ? 0 : 25) },
      { label: '到货验收', pv: isDelivered ? 100 : (isPlanned ? 0 : 0) },
      { label: '批次2发货', pv: isDelivered ? 100 : (isPlanned ? 0 : 10) }
    ];
    var warnings = [];
    batches.forEach(function(b) {
      if (b.pv > 30 && b.pv < 60) warnings.push({ text: b.label + '进行中', level: 'low' });
    });
    return {
      title: '物流运输 · 发货/到货计划 vs 实际进度',
      planned: batches.map(function(b) { return { label: b.label, value: b.pv }; }),
      actual: batches.map(function(b) { return { label: b.label, value: isDelivered ? 100 : (isPlanned ? 0 : Math.round(b.pv * 0.6)) }; }),
      warnings: warnings
    };
  }

  return {
    render: render,
    getMfgData: getMfgData,
    getInstallData: getInstallData,
    getSATData: getSATData,
    getLogisticsData: getLogisticsData
  };
})();
