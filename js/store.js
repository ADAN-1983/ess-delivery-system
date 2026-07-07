// ============================================================
// store.js - ESS交付管理系统 统一数据抽象层
// v1.2 | 2026-06-29 | 同步优先架构，file://协议兼容
// 策略：数据直接内联嵌入，LocalStorage持久化，fetch仅作后台增强
// ============================================================

const Store = (function() {
  'use strict';

  const STORAGE_KEY = 'ess_delivery_v1.2';
  const STORAGE_VERSION = '1.9';
  const DEFAULT_PROJECT_ID = '3';

  let _state = null;
  let _listeners = [];
  let _initResolved = false;

  // ========== 内联数据（主数据源，file://协议下最终兜底）==========
  const EMBEDDED_PROJECTS = [
    {
      "id": "1", "name": "东尚渔光互补0.94GW/188MWh光伏电站项目",
      "capacity": "94MW/188MWh", "batteryTech": "LFP", "cabinetCount": "38",
      "cabinetModel": "5.016MWh液冷集装箱", "location": "江苏连云港",
      "contractType": "EPC", "status": "已交付", "currentPhase": 9,
      "phases": { "1_rnd":{"completed":100},"2_bd":{"completed":100},"3_mfg":{"completed":100},"4_logistics":{"completed":100},"5_install":{"completed":100},"6_commission":{"completed":100},"7_handover":{"completed":100},"8_aftersales":{"completed":100},"9_ops":{"completed":100} }
    },
    {
      "id": "2", "name": "新疆木垒600MWh储能电站项目",
      "capacity": "150MW/600MWh", "batteryTech": "LFP", "cabinetCount": "120",
      "cabinetModel": "1P104S-314Ah电池包", "location": "新疆昌吉州",
      "contractType": "EPC", "status": "已交付", "currentPhase": 9,
      "phases": { "1_rnd":{"completed":100},"2_bd":{"completed":100},"3_mfg":{"completed":100},"4_logistics":{"completed":100},"5_install":{"completed":100},"6_commission":{"completed":100},"7_handover":{"completed":100},"8_aftersales":{"completed":100},"9_ops":{"completed":100} }
    },
    {
      "id": "3", "name": "印度新德里ReNew 120MW/240MWh调峰电站",
      "capacity": "120MW/240MWh", "batteryTech": "LFP", "cabinetCount": "48",
      "cabinetModel": "ArcBank1.0-5.016MWh液冷预制舱", "location": "印度新德里",
      "contractType": "EPC", "status": "交付中", "currentPhase": 3,
      "phases": { "1_rnd":{"completed":100,"notes":"型式试验通过，314Ah电芯"},"2_bd":{"completed":100,"notes":"EPC合同签订（2025-Q3）"},"3_mfg":{"completed":30,"notes":"首批16柜排产中，FAT待执行"},"4_logistics":{"completed":0,"notes":"国际海运计划中"},"5_install":{"completed":0},"6_commission":{"completed":0},"7_handover":{"completed":0},"8_aftersales":{"completed":0},"9_ops":{"completed":0} },
      "delivery": { "fatStandardHours":"8.75h","installStandardDays":"7天/柜","factoryLeadTime":"2-3月/批次(16柜)","shippingRoute":"上海→孟买(海运约25天+清关7天)" }
    },
    {
      "id": "4", "name": "印度安得拉邦225MW/450MWh风光储一体化工程",
      "capacity": "225MW/450MWh", "batteryTech": "LFP", "cabinetCount": "90",
      "cabinetModel": "ArcBank1.0-5.016MWh液冷预制舱", "location": "印度安得拉邦",
      "contractType": "BOO", "status": "计划交付", "currentPhase": 1,
      "phases": { "1_rnd":{"completed":10,"notes":"需求分析阶段"},"2_bd":{"completed":0},"3_mfg":{"completed":0},"4_logistics":{"completed":0},"5_install":{"completed":0},"6_commission":{"completed":0},"7_handover":{"completed":0},"8_aftersales":{"completed":0},"9_ops":{"completed":0} }
    }
  ];

  const EMBEDDED_INSTALL_SOP = {
    "version": "1.0", "product": "ArcBank1.0-5.016MWh",
    "phases": [
      {"id":"ins-1","sortOrder":1,"name":"1. 地基施工","steps":["基础开挖与垫层浇筑","预埋件定位安装","基础养护与强度检测"],"checks":[
        {"id":"ins-1-1","item":"基础水平度校验（≤2mm/m）","content":"用水准仪逐点测量，记录偏差值","standard":"GB 50007-2011","type":"关键","tool":"水准仪"},
        {"id":"ins-1-2","item":"地脚螺栓定位偏差（≤5mm）","content":"用经纬仪复核螺栓间距与对角线","standard":"GB 50231-2009","type":"重要","tool":"经纬仪/钢卷尺"},
        {"id":"ins-1-3","item":"基础强度C30达标","content":"回弹法检测或同条件试块送检","standard":"GB 50010-2010","type":"关键","tool":"回弹仪"},
        {"id":"ins-1-4","item":"基础尺寸偏差（长宽±20mm）","content":"用钢卷尺实测基础长宽尺寸","standard":"GB 50204-2015","type":"重要","tool":"钢卷尺(50m)"},
        {"id":"ins-1-5","item":"预埋件防腐处理","content":"检查预埋件表面镀锌/防腐涂层完好","standard":"GB 50205-2020","type":"推荐","tool":"目视检查","note":"推荐实施"},
        {"id":"ins-1-6","item":"排水设施完备","content":"确认基础周边排水沟/集水井通畅","standard":"JGJ 276-2012","type":"一般","tool":"目视检查"}
      ],"safety":["作业人员佩戴安全帽、绝缘手套/鞋具","基坑围护及警示标识张贴完备"]},
      {"id":"ins-2","sortOrder":2,"name":"2. 预制舱吊装","steps":["吊装方案编制与审批","起重机就位与试吊","预制舱精准落位"],"checks":[
        {"id":"ins-2-1","item":"吊装方案审核","content":"确认方案含应急预案、天气限制、人员资质、JSA分析","standard":"JGJ 276-2012","type":"关键","tool":"方案审查清单"},
        {"id":"ins-2-2","item":"吊具载荷检验","content":"核对吊装带/索具额定载荷≥1.25倍实际载荷","standard":"JB/T 1306-2008","type":"关键","tool":"拉力计/载荷标签"},
        {"id":"ins-2-3","item":"索具安全系数检查","content":"确认主吊索≥5倍、辅吊索≥3倍安全系数","standard":"JGJ 276-2012","type":"关键","tool":"目视检查/规格书"},
        {"id":"ins-2-4","item":"舱体水平度（≤2°）","content":"用水平仪四角测量，调整垫铁高度","standard":"GB 50205-2020","type":"重要","tool":"水平仪"},
        {"id":"ins-2-5","item":"落位精度复测","content":"落位后复测轴线位置偏差≤10mm","standard":"GB 50205-2020","type":"重要","tool":"经纬仪/钢卷尺"},
        {"id":"ins-2-6","item":"吊装记录签署","content":"三方(安装/监理/业主)签署吊装就位记录","standard":"GB 50205-2020","type":"一般","tool":"—"}
      ],"safety":["吊装区域警戒线设置","风速>6级停止作业","起重工持证上岗"]},
      {"id":"ins-3","sortOrder":3,"name":"3. 电气连接","steps":["电缆敷设与标识","直流侧汇流接线","交流侧并网接线"],"checks":[
        {"id":"ins-3-1","item":"电缆绝缘电阻测试（≥20MΩ）","content":"用兆欧表500V档测量线间、对地绝缘","standard":"GB 50150-2016","type":"关键","tool":"兆欧表 500V"},
        {"id":"ins-3-2","item":"相序核对正确","content":"用相序表逐回路核对A/B/C相序一致","standard":"GB 50150-2016","type":"关键","tool":"相序表"},
        {"id":"ins-3-3","item":"接线端子力矩（按厂家规定）","content":"用力矩扳手按厂家规定值紧固并标记","standard":"GB 50254-2016","type":"重要","tool":"数显扭矩扳手(东力CNB100)"},
        {"id":"ins-3-4","item":"电缆相色标识清晰","content":"确认直流红黑/交流黄绿红全线路标识正确","standard":"GB 50171-2012","type":"重要","tool":"目视检查"},
        {"id":"ins-3-5","item":"铜排力矩标记完整","content":"所有铜排连接处做力矩标记线(油漆笔)","standard":"GB 50254-2016","type":"重要","tool":"油漆笔/扭矩扳手"},
        {"id":"ins-3-6","item":"防火封堵严密","content":"电缆穿越孔洞用防火泥/防火板封堵","standard":"GB 50016-2014","type":"关键","tool":"目视检查/防火泥"},
        {"id":"ins-3-7","item":"等电位连接可靠","content":"检查柜体/桥架接地跨接牢固","standard":"GB 50057-2010","type":"关键","tool":"万用表(欧姆档)"}
      ],"safety":["验电确认无电操作","绝缘手套/鞋具佩戴","挂牌上锁(LOTO)"]},
      {"id":"ins-4","sortOrder":4,"name":"4. 液冷管道","steps":["管道预制与试压","管沟开挖与支架安装","管道连接与保温"],"checks":[
        {"id":"ins-4-1","item":"管道压力试验（1.5倍工作压力）","content":"保压30min，压降≤0.02MPa为合格","standard":"GB 50235-2010","type":"关键","tool":"压力泵/压力表"},
        {"id":"ins-4-2","item":"管道冲洗与清洗度","content":"冲洗至出水清澈无杂质，PH值中性","standard":"GB 50235-2010","type":"重要","tool":"PH试纸/目视"},
        {"id":"ins-4-3","item":"保温层厚度与密封","content":"测量保温层厚度≥设计值90%","standard":"GB 50264-2013","type":"重要","tool":"卷尺/测厚仪"},
        {"id":"ins-4-4","item":"支架牢固性检查","content":"手摇支架确认无松动/变形/锈蚀","standard":"GB 50242-2002","type":"重要","tool":"手摇测试"},
        {"id":"ins-4-5","item":"阀门操作灵活性","content":"全开/全关各2次，操作顺畅无卡涩","standard":"GB 50235-2010","type":"一般","tool":"目视检查"}
      ],"safety":["压力试验时人员防护","高处作业安全带","防冻液避免接触皮肤"]},
      {"id":"ins-5","sortOrder":5,"name":"5. 消防系统","steps":["消防管路安装","探测器布置与接线","联动调试"],"checks":[
        {"id":"ins-5-1","item":"灭火器配置数量与类型","content":"按灭火器配置规范计算并现场清点","standard":"GB 50140-2005","type":"关键","tool":"目视清点"},
        {"id":"ins-5-2","item":"烟感/温感安装位置","content":"按设计图纸逐点位核查安装位置","standard":"GB 50166-2019","type":"关键","tool":"图纸核对/目视"},
        {"id":"ins-5-3","item":"消防联动测试","content":"模拟火警触发，验证联动逻辑正确","standard":"GB 50116-2013","type":"关键","tool":"消防烟枪/模拟器"},
        {"id":"ins-5-4","item":"应急照明功能测试","content":"断电后应急照明自动启动且持续≥90min","standard":"GB 17945-2010","type":"重要","tool":"秒表"},
        {"id":"ins-5-5","item":"消防沙箱/消防铲配置","content":"确认沙箱满填、消防铲在指定位置","standard":"GB 50016-2014","type":"一般","tool":"目视检查"}
      ],"safety":["消防通道畅通无遮挡","灭火设备在有效期内","动火作业需审批"]},
      {"id":"ins-6","sortOrder":6,"name":"6. 接地系统","steps":["接地网施工","设备接地连接","接地电阻测试"],"checks":[
        {"id":"ins-6-1","item":"接地电阻（≤4Ω）","content":"用接地电阻测试仪在干燥天气测量","standard":"GB 50169-2016","type":"关键","tool":"接地电阻测试仪(0-200Ω)"},
        {"id":"ins-6-2","item":"等电位连接可靠","content":"检查MEB/LEB端子排连接牢固","standard":"GB 50057-2010","type":"关键","tool":"万用表(欧姆档)"},
        {"id":"ins-6-3","item":"接地线截面达标","content":"测量接地线截面≥设计值或PE线要求","standard":"GB 50169-2016","type":"重要","tool":"卡尺/目视"},
        {"id":"ins-6-4","item":"接地标志清晰","content":"所有接地点应有标准接地标识(⏚)","standard":"GB 50169-2016","type":"重要","tool":"目视检查"},
        {"id":"ins-6-5","item":"断接卡设置(可测试)","content":"便于定期检测时断开测量(推荐实施)","standard":"DL/T 621-1997","type":"推荐","tool":"目视检查","note":"推荐实施"}
      ],"safety":["防雷接地与保护接地分开","雷雨天气禁止接地测试"]},
      {"id":"ins-7","sortOrder":7,"name":"7. 围栏与安防","steps":["围栏安装","监控摄像头布置","门禁系统调试"],"checks":[
        {"id":"ins-7-1","item":"围栏高度≥2.5m","content":"沿围栏随机抽查5点测量高度","standard":"GB 50348-2018","type":"重要","tool":"卷尺(5m)"},
        {"id":"ins-7-2","item":"监控无死角覆盖","content":"现场走查确认覆盖出入口/通道/关键区","standard":"GB 50348-2018","type":"重要","tool":"现场走查/监视器"},
        {"id":"ins-7-3","item":"门禁刷卡功能正常","content":"逐一测试每张授权卡开门/记录功能","standard":"GB 50348-2018","type":"重要","tool":"授权卡"},
        {"id":"ins-7-4","item":"围栏完整性检查","content":"全线巡查围栏无破损/缺口/攀爬点","standard":"GA/T 75-94","type":"一般","tool":"目视巡查"},
        {"id":"ins-7-5","item":"监控存储时长≥30天","content":"查看NVR存储容量和录像保留天数","standard":"GB 50395-2019","type":"一般","tool":"NVR屏显"},
        {"id":"ins-7-6","item":"门禁权限分配合理","content":"核对人员名单与门禁授权一致性","standard":"GB 50348-2018","type":"一般","tool":"权限清单"}
      ],"safety":["作业人员佩戴安全帽、绝缘手套/鞋具","基坑围护及警示标识张贴完备","消防通道畅通、灭火设备可用且在有效期内","验电确认无电操作、接地可靠"]}
    ],
    "sevenM1E": {"人":"持证电工、焊工、起重工","机":"25T~100T汽车吊、力矩扳手(东力CNB100)、绝缘测试仪(MIT525)、水准仪/经纬仪","料":"电缆/铜排/螺栓/密封件/防火泥/安全警示带","法":"厂家安装手册+目标国当地规范(IEC/IS/GB)","环":"环境温度0-45℃、湿度<85%RH、风速<6级(吊装时)","测":"绝缘电阻测试仪、接地电阻测试仪(0-200Ω)、水平仪、力矩扳手、兆欧表","管理":"项目经理到岗、安全员持证、班前会安全交底、作业票签发、JSA工作安全分析","能源":"临时用电三级箱配置、线缆载流核算确认、动火作业审批(二级动火)、受限空间许可(进入DC舱前气体检测)"}
  };

  const EMBEDDED_SAT_SOP = {
  "productName": "ArcBank1.0-5.016MWh液冷预制舱式储能系统",
  "totalStandardHours": "约18h（不含7天试运行）",
  "version": "v2.0-基于工程标准化流程",
  "phases": [
    {
      "id": "sat-1",
      "name": "调试准备及安全前置",
      "sortOrder": 1,
      "standardHours": "1.5h",
      "canParallel": true,
      "checks": [
        {
          "id": "sat-1-1",
          "item": "资料审查",
          "content": "A.图纸与文档确认：核对电气单线图、通信拓扑图、用户手册、技术协议；B.设备参数核对：核对电池、PCS、BMS、EMS参数；C.保护定值校核：核对定值单、涉网保护定值",
          "method": "逐项比对法",
          "standard": "所有图纸为最新版；设备参数与技术协议一致；定值无冲突",
          "tool": "图纸、签字笔、参数配置手册、定值单打印件",
          "record": "图纸会审记录单、设备参数核对报告、保护定值校核确认单",
          "pass": null,
          "notes": "差异项需发DCR闭环"
        },
        {
          "id": "sat-1-2",
          "item": "安全交底",
          "content": "A.测试前安全交底：明确作业范围、高压区域、急停位置、触电急救流程；B.LOTO上锁挂牌培训：讲解断电、上锁、挂牌的标准流程",
          "method": "会议培训+现场指认",
          "standard": "所有作业人员签字确认；掌握LOTO流程",
          "tool": "安全交底记录表、LOTO作业指导书",
          "record": "测试前安全交底记录、LOTO培训记录",
          "pass": null,
          "notes": "未签字不得进入高压区"
        },
        {
          "id": "sat-1-3",
          "item": "SAT合规性确认",
          "content": "核对现场安全许可、当地调试规程、并网规范，确认具备SAT调试条件",
          "method": "文件审核+现场确认",
          "standard": "具备SAT调试条件；无合规性风险项",
          "tool": "合规审查清单",
          "record": "SAT合规性确认记录表、合规性确认单",
          "pass": null,
          "notes": "调试必须先合规再开工"
        },
        {
          "id": "sat-1-4",
          "item": "安全警示区设置",
          "content": "拉设安全警示带，放置安全警示牌，围蔽范围≥工作区外延1m",
          "method": "目视+测量",
          "standard": "警示带围蔽≥工作区外延1m；高压危险标识面向通道侧",
          "tool": "安全警示带、安全警示牌",
          "record": "警示区域布置图、现场照片",
          "pass": null,
          "notes": "雨天每2小时巡检"
        }
      ]
    },
    {
      "id": "sat-2",
      "name": "设备外观与线束连接检查",
      "sortOrder": 2,
      "standardHours": "1h",
      "canParallel": true,
      "checks": [
        {
          "id": "sat-2-1",
          "item": "储能集装箱外观检查",
          "content": "舱体无变形凹陷锈蚀、焊缝无裂纹螺栓紧固、柜门密封良好开合正常、铭牌标识完整清晰",
          "method": "目视法",
          "standard": "舱体无变形/凹陷/锈蚀；焊缝无裂纹；密封良好",
          "tool": "手电筒、目视",
          "record": "外观缺陷照片",
          "pass": null,
          "notes": "内部检查需戴绝缘手套"
        },
        {
          "id": "sat-2-2",
          "item": "电池簇外观与标识检查",
          "content": "电池外观清洁无秽物损伤划痕锈蚀、型号标识清晰且与图纸一致",
          "method": "目视+型号核对",
          "standard": "外观无损伤；型号标识清晰；与图纸一致",
          "tool": "目视",
          "record": "型号核对记录",
          "pass": null,
          "notes": "轻拿轻放避免磕碰"
        },
        {
          "id": "sat-2-3",
          "item": "高压箱/PDU外观接线检查",
          "content": "外观清洁无损伤、接线牢固无松动、标识清晰",
          "method": "目视法",
          "standard": "外观清洁；接线牢固无松动",
          "tool": "目视",
          "record": "接线照片",
          "pass": null,
          "notes": "检查前必须断电验电"
        },
        {
          "id": "sat-2-4",
          "item": "消防系统外观功能检查",
          "content": "探测器喷头无堵塞、管路无老化松动、灭火剂储量≥设计值90%",
          "method": "目视+储量读取",
          "standard": "探测器无堵塞；灭火剂储量≥90%",
          "tool": "手电筒",
          "record": "现场照片",
          "pass": null,
          "notes": "关闭联动灭火功能防止误喷"
        },
        {
          "id": "sat-2-5",
          "item": "汇流柜/配电柜外观接线检查",
          "content": "外观清洁无损伤、高压电缆铜排锁附扭力符合原厂规范",
          "method": "目视+数显扳手扭矩检测",
          "standard": "外观清洁；扭力符合原厂规范",
          "tool": "数显扳手、目视",
          "record": "扭力记录",
          "pass": null,
          "notes": ""
        },
        {
          "id": "sat-2-6",
          "item": "液冷系统外观管路检查",
          "content": "风机泵无移位松动破损、管路无漏液裂纹凹陷、温度传感器接线牢固",
          "method": "目视+压力表",
          "standard": "风机泵无移位松动；管路无漏液",
          "tool": "压力表、目视",
          "record": "管路压力记录",
          "pass": null,
          "notes": "确认系统无压后再检查"
        },
        {
          "id": "sat-2-7",
          "item": "动力线束连接布线检查",
          "content": "线束无漏装松脱老化破皮、正负极无反接、端子压接无虚接布线整齐",
          "method": "目视+插拔试验",
          "standard": "线束无漏装松脱；正负极不反接",
          "tool": "接线图、扎带、扳手",
          "record": "接线照片",
          "pass": null,
          "notes": "带电线束检查前必须验电"
        },
        {
          "id": "sat-2-8",
          "item": "低压线束连接通断检查",
          "content": "菊花链插头插紧无松动防呆结构卡紧、各端口连接牢固无错接、线号标识与图纸100%一致",
          "method": "目视+线号读取器",
          "standard": "插头插紧无松动；线号与图纸一致",
          "tool": "接线图、接口定义文档",
          "record": "接线照片",
          "pass": null,
          "notes": "握住外壳禁止拉扯线缆"
        },
        {
          "id": "sat-2-9",
          "item": "接地系统导通检查",
          "content": "接地端子连接牢固无松动锈蚀、接地跨接线完整无断点",
          "method": "目视+接地电阻测试仪",
          "standard": "接地端子连接牢固；接地电阻≤4Ω",
          "tool": "接地电阻测试仪",
          "record": "接地电阻记录",
          "pass": null,
          "notes": ""
        }
      ]
    },
    {
      "id": "sat-3",
      "name": "全系统绝缘检测",
      "sortOrder": 3,
      "standardHours": "2h",
      "canParallel": true,
      "checks": [
        {
          "id": "sat-3-1",
          "item": "PACK电池簇绝缘检测",
          "content": "1000V DC兆欧表测量正极/负极对壳体绝缘电阻",
          "method": "兆欧表测量",
          "standard": "常温下正极/负极-外壳≥500MΩ；高温高湿环境≥0.5MΩ/kV",
          "tool": "1000V DC兆欧表",
          "record": "绝缘测试原始数据、测试仪导出文件",
          "pass": null,
          "notes": "抽检20%；静置放电≥15min"
        },
        {
          "id": "sat-3-2",
          "item": "RACK机架绝缘检测",
          "content": "2500V DC兆欧表测量总正/总负对地(机架)绝缘电阻",
          "method": "兆欧表测量",
          "standard": "总正/总负-地(机架)≥100MΩ",
          "tool": "2500V DC兆欧表",
          "record": "绝缘测试原始数据",
          "pass": null,
          "notes": "全检重点检查螺栓接线端子"
        },
        {
          "id": "sat-3-3",
          "item": "BANK电池堆绝缘检测",
          "content": "2500V DC兆欧表测量相间、相对地绝缘电阻",
          "method": "兆欧表测量+地阻仪",
          "standard": "正母排-负母排≥100MΩ；相-地≥100MΩ",
          "tool": "2500V DC兆欧表、地阻仪",
          "record": "绝缘测试原始数据、接地电阻记录",
          "pass": null,
          "notes": "柜体接地电阻≤4Ω"
        },
        {
          "id": "sat-3-4",
          "item": "DCPM高压箱绝缘检测",
          "content": "2500V DC兆欧表测量直流输入正/负-地、控制电源端子-地绝缘",
          "method": "兆欧表测量",
          "standard": "直流输入正/负-地≥100MΩ；控制电源端子-地≥10MΩ",
          "tool": "2500V DC兆欧表",
          "record": "绝缘测试原始数据",
          "pass": null,
          "notes": "断开高压进线；确认内部电容无残留电荷"
        },
        {
          "id": "sat-3-5",
          "item": "PCS变流器绝缘检测",
          "content": "DC侧2500V AC侧1000V兆欧表测量DC/AC各相对地绝缘",
          "method": "兆欧表测量",
          "standard": "DC侧正/负-地≥100MΩ；AC侧L1/L2/L3-地≥100MΩ",
          "tool": "2500V DC兆欧表、1000V DC兆欧表",
          "record": "绝缘测试原始数据",
          "pass": null,
          "notes": "控制柜接地电阻<4Ω"
        }
      ]
    },
    {
      "id": "sat-4",
      "name": "软件升级与系统配置",
      "sortOrder": 4,
      "standardHours": "2.5h",
      "canParallel": true,
      "checks": [
        {
          "id": "sat-4-1",
          "item": "BMS BCU软件升级",
          "content": "登录BMS监控平台→设备管理→BCU Info→核对当前版本号→升级至指定版本→核对MD5值",
          "method": "上位机操作",
          "standard": "版本号/MD5值与清单一致；CAN总线通信正常",
          "tool": "上位机、BMS监控软件",
          "record": "升级前后版本截图、通信参数校验图",
          "pass": null,
          "notes": "CAN总线参数500Kbps/CAN2.0B/无校验"
        },
        {
          "id": "sat-4-2",
          "item": "BMS参数配置",
          "content": "核对额定参数和保护阈值→配置充放电曲线和SOC上下限→配置保护动作逻辑→双人复核",
          "method": "上位机配置+双人复核",
          "standard": "所有参数与技术协议一致；保护阈值无冲突",
          "tool": "上位机、参数配置手册",
          "record": "参数配置表、双人复核记录",
          "pass": null,
          "notes": "修改后需重启验证"
        },
        {
          "id": "sat-4-3",
          "item": "PCS软件升级",
          "content": "登录PCS监控界面→核对固件版本→升级至指定版本→核对版本号",
          "method": "PCS监控界面操作",
          "standard": "版本号与清单一致；通信正常",
          "tool": "上位机、PCS监控软件",
          "record": "升级前后版本截图",
          "pass": null,
          "notes": "升级过程不得断电否则损坏设备"
        },
        {
          "id": "sat-4-4",
          "item": "PCS参数配置",
          "content": "核对额定功率电压电流参数→配置并网保护定值→配置充放电控制逻辑→双人复核",
          "method": "PCS界面操作+双人复核",
          "standard": "参数与设计定值单一致；并网保护定值符合电网要求",
          "tool": "上位机、定值单",
          "record": "参数配置表、定值复核记录",
          "pass": null,
          "notes": "涉网定值需电网调度备案"
        },
        {
          "id": "sat-4-5",
          "item": "EMS能量管理系统配置",
          "content": "配置系统拓扑和设备通信地址→配置调度策略和充放电计划→配置告警阈值和联动逻辑→测试通信链路",
          "method": "EMS界面操作+链路测试",
          "standard": "所有设备通信正常；调度策略与设计一致",
          "tool": "上位机、EMS监控软件",
          "record": "系统配置表、通信测试记录",
          "pass": null,
          "notes": "确保通信地址无冲突"
        },
        {
          "id": "sat-4-6",
          "item": "液冷系统参数配置",
          "content": "配置温度控制阈值和泵转速→配置告警阈值和保护逻辑→测试系统启停和温控逻辑",
          "method": "液冷控制器操作",
          "standard": "温度控制精度符合设计；泵启停逻辑正确",
          "tool": "液冷系统控制器",
          "record": "参数配置表、温控测试记录",
          "pass": null,
          "notes": "温控阈值需与BMS保护阈值匹配"
        },
        {
          "id": "sat-4-7",
          "item": "消防系统联动配置",
          "content": "配置火灾探测器告警阈值→配置BMS/PCS联动逻辑→测试告警信号上传",
          "method": "消防控制器操作+模拟测试",
          "standard": "探测器告警准确；联动逻辑符合设计",
          "tool": "消防系统控制器",
          "record": "联动配置表、告警测试记录",
          "pass": null,
          "notes": "关闭灭火装置防止误喷"
        }
      ]
    },
    {
      "id": "sat-5",
      "name": "低压系统调试",
      "sortOrder": 5,
      "standardHours": "2h",
      "canParallel": false,
      "checks": [
        {
          "id": "sat-5-1",
          "item": "UPS启动与带载测试",
          "content": "闭合UPS输入开关→长按开机键5s启动→核对输出电压频率→测试旁路切换和后备模式",
          "method": "功能测试",
          "standard": "启动正常输出符合额定；旁路切换无中断；后备续航≥15min",
          "tool": "万用表、秒表",
          "record": "UPS启动日志、带载测试记录",
          "pass": null,
          "notes": "确认输入电压正常无短路"
        },
        {
          "id": "sat-5-2",
          "item": "液冷系统低压调试",
          "content": "闭合供电开关→启动系统测试泵风机启停→测试温控逻辑和压力保护→测试与BMS通信",
          "method": "功能测试+参数监测",
          "standard": "泵风机启停正常；温控逻辑符合设计；通信正常",
          "tool": "压力表、上位机",
          "record": "液冷系统运行日志、温控测试记录",
          "pass": null,
          "notes": "确认管路无泄漏阀门正确"
        },
        {
          "id": "sat-5-3",
          "item": "消防系统低压调试",
          "content": "闭合供电开关→测试探测器和报警器功能→测试与BMS动环通信→模拟告警信号测试联动",
          "method": "功能测试+模拟触发",
          "standard": "探测器报警器功能正常；通信正常；告警准确上传",
          "tool": "消防系统测试工具",
          "record": "消防系统测试记录、告警测试记录",
          "pass": null,
          "notes": "关闭灭火装置防止误喷"
        },
        {
          "id": "sat-5-4",
          "item": "动环监控系统调试",
          "content": "闭合供电开关→测试水浸温湿度门禁传感器→测试与BMS EMS通信→模拟异常测试告警联动",
          "method": "功能测试+模拟触发",
          "standard": "传感器功能正常；通信正常；告警联动符合设计",
          "tool": "动环监控平台、模拟工具",
          "record": "动环系统测试记录、告警测试记录",
          "pass": null,
          "notes": "传感器安装位置符合设计"
        },
        {
          "id": "sat-5-5",
          "item": "除湿系统调试",
          "content": "闭合供电开关→启动系统测试启停逻辑→测试湿度控制阈值→测试与动环通信",
          "method": "功能测试",
          "standard": "除湿机启停正常；湿度控制符合设计",
          "tool": "湿度计、上位机",
          "record": "除湿系统运行记录",
          "pass": null,
          "notes": "湿度传感器校准准确"
        },
        {
          "id": "sat-5-6",
          "item": "照明与辅助系统调试",
          "content": "闭合供电开关→测试灯具应急照明→测试插座辅助电源",
          "method": "功能测试",
          "standard": "灯具应急照明正常；插座电压正常；无短路",
          "tool": "万用表、目视",
          "record": "照明系统测试记录",
          "pass": null,
          "notes": "应急照明断电切换功能正常"
        }
      ]
    },
    {
      "id": "sat-6",
      "name": "高压系统调试",
      "sortOrder": 6,
      "standardHours": "2.5h",
      "canParallel": false,
      "checks": [
        {
          "id": "sat-6-1",
          "item": "预充回路测试",
          "content": "断开所有高压负载→闭合预充回路开关→监测预充电压电流→核对完成时间和电压阈值",
          "method": "电压电流监测",
          "standard": "预充回路正常；预充电压达额定90%以上；无过流告警",
          "tool": "万用表、上位机",
          "record": "预充测试记录、电压电流曲线",
          "pass": null,
          "notes": "预充未完成不得闭合主回路"
        },
        {
          "id": "sat-6-2",
          "item": "高压合闸操作",
          "content": "确认预充完成→依次闭合汇流柜总开关和各簇隔离开关→监测母线电压电流→核对BMS PCS状态",
          "method": "顺序操作+状态监测",
          "standard": "合闸无冲击无告警；母线电压稳定在额定值",
          "tool": "万用表、上位机",
          "record": "高压合闸记录、母线电压曲线",
          "pass": null,
          "notes": "严格遵循先低压后高压时序"
        },
        {
          "id": "sat-6-3",
          "item": "高压互锁(HVL)功能验证",
          "content": "正常运行状态下断开互锁回路或触发急停→监测BMS PCS动作→核对告警信息",
          "method": "模拟触发+状态监测",
          "standard": "HVL触发后BMS立即切断高压 PCS停机；告警准确上传",
          "tool": "模拟触发工具、上位机",
          "record": "高压互锁测试记录、告警日志",
          "pass": null,
          "notes": "做好绝缘防护；测试后复位"
        },
        {
          "id": "sat-6-4",
          "item": "绝缘监测(IND)功能验证",
          "content": "正常运行状态下模拟绝缘下降至告警阈值→监测BMS动作→核对保护动作逻辑",
          "method": "故障模拟+状态监测",
          "standard": "绝缘降至阈值时BMS上报告警；触限功率禁充禁放",
          "tool": "绝缘故障模拟工具、上位机",
          "record": "绝缘监测测试记录、告警日志",
          "pass": null,
          "notes": "测试后恢复系统绝缘"
        },
        {
          "id": "sat-6-5",
          "item": "短路保护功能验证",
          "content": "断开高压负载模拟短路故障→闭合短路回路监测保护动作→核对动作时间和动作逻辑",
          "method": "短路模拟+波形分析",
          "standard": "短路触发后过流保护立即动作接触器分断；时间符合设计",
          "tool": "短路模拟装置、示波器",
          "record": "短路保护测试记录、动作波形",
          "pass": null,
          "notes": "确认系统无残留电荷；测试后检查设备"
        },
        {
          "id": "sat-6-6",
          "item": "SPD与熔断器测试",
          "content": "断电状态下核对型号规格→测试SPD绝缘漏流→测试熔断器通断→核对接线",
          "method": "断电检测+导通测试",
          "standard": "型号与图纸一致；绝缘符合规范；导通正常",
          "tool": "兆欧表、万用表",
          "record": "SPD与熔断器测试记录",
          "pass": null,
          "notes": "断电状态测试"
        },
        {
          "id": "sat-6-7",
          "item": "RCD漏电保护功能验证",
          "content": "正常运行状态按下RCD测试按钮→监测RCD动作和系统反应",
          "method": "手动触发+状态监测",
          "standard": "按下后RCD立即脱扣；系统告警 PCS停机",
          "tool": "手动触发工具、上位机",
          "record": "RCD测试记录、告警日志",
          "pass": null,
          "notes": "测试后复位RCD确认无故障"
        }
      ]
    },
    {
      "id": "sat-7",
      "name": "充放电性能测试",
      "sortOrder": 7,
      "standardHours": "8.5h",
      "canParallel": false,
      "checks": [
        {
          "id": "sat-7-1",
          "item": "0.1P小功率充放电测试",
          "content": "以0.1P恒功率充电5min→静置10min→0.1P放电5min→静置10min→监测电压电流温度",
          "method": "恒功率充放电+多参量监测",
          "standard": "无告警无保护动作；电芯温差≤5℃",
          "tool": "上位机、温度巡检仪",
          "record": "充放电记录、电压电流曲线、温度曲线",
          "pass": null,
          "notes": "实时监控电芯温度超温立即停机"
        },
        {
          "id": "sat-7-2",
          "item": "0.2P→0.5P阶梯升功率测试",
          "content": "0.2P充电5min→每5min增0.1P直至0.5P→0.5P充电5min→静置10min→同阶梯方式放电",
          "method": "阶梯升功率充放电+监测",
          "standard": "各功率段稳定无告警；电芯温差≤8℃",
          "tool": "上位机、温度巡检仪",
          "record": "充放电记录、功率曲线、温度曲线",
          "pass": null,
          "notes": "升功率过程中异常立即停机"
        },
        {
          "id": "sat-7-3",
          "item": "额定功率充放电循环测试",
          "content": "0.5P恒功率充电至截止→恒压充电至0.05C→静置30min→0.5P放电至截止→静置30min→重复1循环",
          "method": "完整充放电循环+容量计算",
          "standard": "实际放电容量≥额定容量的95%；单体最高温度≤48℃",
          "tool": "上位机、温度巡检仪、功率分析仪",
          "record": "充放电循环记录、容量测试报告、温度曲线",
          "pass": null,
          "notes": "全程监控超温过压立即停机"
        },
        {
          "id": "sat-7-4",
          "item": "极限工况测试",
          "content": "0.5P功率最高环境温度下充放电→监测电芯温度和保护动作→核对高温保护阈值",
          "method": "高温环境下充放电测试",
          "standard": "高温环境充放电正常；电芯温度在设计范围内",
          "tool": "上位机、温度巡检仪",
          "record": "高温充放电测试记录、温度曲线",
          "pass": null,
          "notes": "全程监控电芯温度"
        },
        {
          "id": "sat-7-5",
          "item": "系统效率测试",
          "content": "0.5P额定功率充电测直流输入能量交流输出能量→计算充电效率→放电同理→计算往返效率",
          "method": "能量计量+效率计算",
          "standard": "系统往返效率≥设计值；单充单放效率符合设计",
          "tool": "功率分析仪、上位机",
          "record": "系统效率测试报告、能量记录",
          "pass": null,
          "notes": "测试过程中系统稳定无波动"
        },
        {
          "id": "sat-7-6",
          "item": "指令响应时间测试",
          "content": "待机状态下发充放电指令记录响应时间→下发功率调整指令记录响应时间→重复3次取平均",
          "method": "指令下发+计时测量",
          "standard": "充放电指令响应时间≤设计要求；功率调整响应时间≤设计要求",
          "tool": "示波器、上位机",
          "record": "响应时间测试记录、指令响应曲线",
          "pass": null,
          "notes": ""
        }
      ]
    },
    {
      "id": "sat-8",
      "name": "并网与系统联动测试",
      "sortOrder": 8,
      "standardHours": "4h",
      "canParallel": false,
      "checks": [
        {
          "id": "sat-8-1",
          "item": "孤岛保护功能测试",
          "content": "并网运行额定功率输出→模拟电网失电触发孤岛→监测PCS动作和停机时间→核对保护逻辑",
          "method": "电网故障模拟",
          "standard": "孤岛触发后在规定时间内停机；动作逻辑正确",
          "tool": "电网故障模拟装置、上位机",
          "record": "孤岛保护测试记录、动作波形",
          "pass": null,
          "notes": "确认电网侧安全措施到位"
        },
        {
          "id": "sat-8-2",
          "item": "电压/频率响应测试",
          "content": "并网运行→模拟电网电压在允许范围内波动→监测系统状态和功率→模拟频率波动监测",
          "method": "电网模拟装置测试",
          "standard": "电压/频率允许范围内波动时正常运行；无脱网无告警",
          "tool": "电网模拟装置、上位机",
          "record": "电压/频率响应测试记录",
          "pass": null,
          "notes": "确认电网参数符合设计"
        },
        {
          "id": "sat-8-3",
          "item": "并网谐波测试",
          "content": "并网运行额定功率→功率分析仪测并网电流谐波含量→测试THD和各次谐波含量",
          "method": "功率分析仪测量",
          "standard": "并网电流总谐波畸变率THD≤5%；符合GB/T 19964标准",
          "tool": "功率分析仪",
          "record": "谐波测试报告、谐波频谱图",
          "pass": null,
          "notes": "测试过程中系统稳定"
        },
        {
          "id": "sat-8-4",
          "item": "AGC/AVC响应测试",
          "content": "并网运行→调度下发AGC AVC指令→监测功率/电压响应→核对响应时间和精度",
          "method": "调度模拟测试",
          "standard": "响应时间符合调度要求；控制精度符合设计",
          "tool": "电网调度模拟装置、上位机",
          "record": "AGC/AVC响应测试记录",
          "pass": null,
          "notes": "确认调度接口正常"
        },
        {
          "id": "sat-8-5",
          "item": "消防系统联动测试",
          "content": "正常运行状态→模拟火灾探测器告警→监测BMS PCS消防动作→核对联动逻辑",
          "method": "火灾告警模拟",
          "standard": "火灾告警触发后BMS切断高压 PCS停机；消防启动灭火",
          "tool": "消防告警模拟工具、上位机",
          "record": "消防联动测试记录、告警日志",
          "pass": null,
          "notes": "关闭灭火装置防止误喷"
        },
        {
          "id": "sat-8-6",
          "item": "液冷系统联动测试",
          "content": "正常运行状态→模拟流量不足温度异常→监测BMS液冷动作→核对联动逻辑",
          "method": "液冷故障模拟",
          "standard": "液冷异常时BMS触发降功率/停机；联动动作正常",
          "tool": "液冷故障模拟工具、上位机",
          "record": "液冷联动测试记录、告警日志",
          "pass": null,
          "notes": "确认液冷无泄漏"
        },
        {
          "id": "sat-8-7",
          "item": "动环系统联动测试",
          "content": "正常运行状态→模拟水浸温湿度异常门禁告警→监测动环BMS EMS动作→核对联动逻辑",
          "method": "环境异常模拟",
          "standard": "环境异常时立即上报告警；联动逻辑符合设计",
          "tool": "环境异常模拟工具、上位机",
          "record": "动环联动测试记录、告警日志",
          "pass": null,
          "notes": "确认传感器功能正常"
        }
      ]
    },
    {
      "id": "sat-9",
      "name": "SAT验收测试与偏差整改",
      "sortOrder": 9,
      "standardHours": "4h",
      "canParallel": false,
      "checks": [
        {
          "id": "sat-9-1",
          "item": "集装箱外观验收",
          "content": "舱体无变形无锈蚀密封良好标识清晰",
          "method": "目视检查",
          "standard": "舱体无变形/锈蚀/损伤；密封良好",
          "tool": "目视",
          "record": "外观验收记录",
          "pass": null,
          "notes": ""
        },
        {
          "id": "sat-9-2",
          "item": "电池簇外观验收",
          "content": "外观无损伤标识清晰与图纸一致",
          "method": "目视+型号核对",
          "standard": "外观无损伤；型号与图纸一致",
          "tool": "目视",
          "record": "外观验收记录",
          "pass": null,
          "notes": ""
        },
        {
          "id": "sat-9-3",
          "item": "线束连接验收",
          "content": "动力/低压线束连接牢固线号与图纸一致无虚接",
          "method": "目视+拉力检查",
          "standard": "线束连接牢固；线号与图纸一致",
          "tool": "目视",
          "record": "线束验收记录",
          "pass": null,
          "notes": ""
        },
        {
          "id": "sat-9-4",
          "item": "绝缘电阻验收",
          "content": "主回路对地绝缘电阻≥100MΩ 辅助回路≥1MΩ",
          "method": "兆欧表复测",
          "standard": "主回路≥100MΩ 辅助回路≥1MΩ",
          "tool": "兆欧表",
          "record": "绝缘验收记录",
          "pass": null,
          "notes": ""
        },
        {
          "id": "sat-9-5",
          "item": "接地连续性验收",
          "content": "接地端子至箱体电阻≤0.1Ω",
          "method": "微欧表测量",
          "standard": "接地电阻≤0.1Ω",
          "tool": "微欧表",
          "record": "接地验收记录",
          "pass": null,
          "notes": ""
        },
        {
          "id": "sat-9-6",
          "item": "耐压测试验收",
          "content": "主回路对地4200V DC 1min 无闪络击穿",
          "method": "耐压测试仪",
          "standard": "4200V DC 1min无闪络击穿",
          "tool": "耐压测试仪",
          "record": "耐压验收记录",
          "pass": null,
          "notes": ""
        },
        {
          "id": "sat-9-7",
          "item": "保护功能验收",
          "content": "高压互锁、绝缘监测、短路保护动作正常",
          "method": "功能验证",
          "standard": "HVL/IND/短路保护均动作正常",
          "tool": "上位机、模拟工具",
          "record": "保护功能验收记录",
          "pass": null,
          "notes": ""
        },
        {
          "id": "sat-9-8",
          "item": "BMS保护功能验收",
          "content": "过充/过放/过流保护动作正常无拒动误动",
          "method": "功能验证",
          "standard": "过充/过放/过流保护正常",
          "tool": "上位机",
          "record": "BMS保护验收记录",
          "pass": null,
          "notes": ""
        },
        {
          "id": "sat-9-9",
          "item": "系统联动功能验收",
          "content": "消防、液冷、动环系统联动逻辑正确",
          "method": "联动测试",
          "standard": "消防/液冷/动环联动逻辑正确",
          "tool": "模拟工具、上位机",
          "record": "联动验收记录",
          "pass": null,
          "notes": ""
        },
        {
          "id": "sat-9-10",
          "item": "充放电性能验收",
          "content": "实际容量≥额定容量的95% 充放电过程无异常",
          "method": "数据复核",
          "standard": "实际容量≥95%；过程无异常",
          "tool": "上位机、功率分析仪",
          "record": "性能验收记录",
          "pass": null,
          "notes": ""
        },
        {
          "id": "sat-9-11",
          "item": "充放电温度管控验收",
          "content": "单簇电芯温差≤8℃ 单体最高温度≤48℃",
          "method": "温度数据复核",
          "standard": "电芯温差≤8℃；最高温度≤48℃",
          "tool": "上位机、温度巡检仪",
          "record": "温度验收记录",
          "pass": null,
          "notes": ""
        },
        {
          "id": "sat-9-12",
          "item": "并网保护功能验收",
          "content": "孤岛保护、电压/频率响应符合并网规范",
          "method": "并网测试复核",
          "standard": "符合GB/T 19964并网规范",
          "tool": "电网模拟装置",
          "record": "并网验收记录",
          "pass": null,
          "notes": ""
        },
        {
          "id": "sat-9-13",
          "item": "资料归档验收",
          "content": "全套调试记录、测试报告、确认单完整",
          "method": "资料清点",
          "standard": "全套资料齐全完整可追溯",
          "tool": "文档模板",
          "record": "资料归档清单",
          "pass": null,
          "notes": "偏差项闭环"
        }
      ]
    },
    {
      "id": "sat-10",
      "name": "型式试验报告备查",
      "sortOrder": 10,
      "standardHours": "0.5h",
      "canParallel": true,
      "checks": [
        {
          "id": "sat-10-1",
          "item": "振动测试报告核对",
          "content": "振动测试符合UL 1973/EN 62619标准",
          "method": "报告核对",
          "standard": "第三方认可报告在有效期内",
          "tool": "报告原件/扫描件",
          "record": "型式试验核对记录",
          "pass": null,
          "notes": "现场无需测试仅核对报告"
        },
        {
          "id": "sat-10-2",
          "item": "冲击测试报告核对",
          "content": "冲击测试符合UL 1973/EN 62619标准",
          "method": "报告核对",
          "standard": "第三方认可报告在有效期内",
          "tool": "报告原件/扫描件",
          "record": "型式试验核对记录",
          "pass": null,
          "notes": "现场无需测试仅核对报告"
        },
        {
          "id": "sat-10-3",
          "item": "结构强度测试报告核对",
          "content": "结构强度测试符合UL 1973/EN 62619标准",
          "method": "报告核对",
          "standard": "第三方认可报告在有效期内",
          "tool": "报告原件/扫描件",
          "record": "型式试验核对记录",
          "pass": null,
          "notes": "现场无需测试仅核对报告"
        },
        {
          "id": "sat-10-4",
          "item": "温度循环测试报告核对",
          "content": "温度循环测试符合UL 1973/EN 62619标准",
          "method": "报告核对",
          "standard": "第三方认可报告在有效期内",
          "tool": "报告原件/扫描件",
          "record": "型式试验核对记录",
          "pass": null,
          "notes": "现场无需测试仅核对报告"
        },
        {
          "id": "sat-10-5",
          "item": "湿热测试报告核对",
          "content": "湿热测试符合UL 1973/EN 62619标准",
          "method": "报告核对",
          "standard": "第三方认可报告在有效期内",
          "tool": "报告原件/扫描件",
          "record": "型式试验核对记录",
          "pass": null,
          "notes": "现场无需测试仅核对报告"
        },
        {
          "id": "sat-10-6",
          "item": "热滥用测试报告核对",
          "content": "热滥用测试符合UL 1973/EN 62619标准",
          "method": "报告核对",
          "standard": "第三方认可报告在有效期内",
          "tool": "报告原件/扫描件",
          "record": "型式试验核对记录",
          "pass": null,
          "notes": "现场无需测试仅核对报告"
        },
        {
          "id": "sat-10-7",
          "item": "阻燃测试报告核对",
          "content": "阻燃测试符合UL 1973/EN 62619标准",
          "method": "报告核对",
          "standard": "第三方认可报告在有效期内",
          "tool": "报告原件/扫描件",
          "record": "型式试验核对记录",
          "pass": null,
          "notes": "现场无需测试仅核对报告"
        },
        {
          "id": "sat-10-8",
          "item": "元器件安全认证核对",
          "content": "元器件符合UL/CE标准要求",
          "method": "证书核对",
          "standard": "UL/CE认证报告在有效期内",
          "tool": "认证报告",
          "record": "型式试验核对记录",
          "pass": null,
          "notes": "现场无需测试仅核对报告"
        },
        {
          "id": "sat-10-9",
          "item": "EMC电磁兼容测试报告核对",
          "content": "EMC全项测试符合EN 61000系列标准",
          "method": "报告核对",
          "standard": "第三方认可的EMC报告在有效期内",
          "tool": "EMC测试报告",
          "record": "型式试验核对记录",
          "pass": null,
          "notes": "现场无需测试仅核对报告"
        }
      ]
    }
  ],
  "sevenM1E": {
    "人Man": "调试负责人（统筹）、系统工程师（软件配置）、测试工程师（绝缘/高压）、并网工程师（并网联调）、安全员（全程监督）——均持证上岗且已完成安全交底",
    "机Machine": "BMS上位机、PCS监控软件、EMS系统、功率分析仪、1000V/2500V DC兆欧表、万用表、示波器、绝缘故障模拟工具、短路模拟装置、电网故障模拟装置、温度巡检仪、压力表、接地电阻测试仪、数显扳手",
    "料Material": "电气单线图、通信拓扑图、用户手册、技术协议、参数配置手册、保护定值单、调试SOP、LOTO作业指导书、安全交底记录表、各类测试记录表格",
    "法Method": "本标准化流程（基于GB/T 36547储能系统接入配电网测试规范、GB/T 19964光伏发电站接入电力系统技术规定、DL/T 2246电化学储能电站调试规程）",
    "环Environment": "现场安全警示区已设置、并网许可已获取、温湿度在设备允许范围内、天气条件满足户外作业要求",
    "测Measurement": "所有测试仪表均在有效检定/校准周期内；测试前已做零位校准",
    "Management": "调试计划已审批通过、各方人员已到位、偏差处理流程已明确、验收见证方已通知"
  },
  "witnessManagement": {
    "requiredWitnesses": [
      {
        "role": "业主代表/监理",
        "required": true,
        "name": "",
        "signed": false,
        "date": ""
      },
      {
        "role": "卖方代表",
        "required": true,
        "name": "郑丹",
        "signed": false,
        "date": ""
      },
      {
        "role": "第三方检测机构(可选)",
        "required": false,
        "name": "",
        "signed": false,
        "date": ""
      }
    ],
    "witnessCheckpoints": [
      "高压合闸见证",
      "充放电性能测试见证",
      "并网联调测试见证",
      "SAT最终验收签署"
    ]
  }
};

  const EMBEDDED_FAT_SOP = {
    "version": "2.0", "product": "ArcBank1.0-5.016MWh",
    "phases": [
      {"id":"fat-0","sortOrder":0,"name":"前置条件","standardHours":"30min","canParallel":true,"witness":"质量工程师/生产主管",
        "checks":[
          {"id":"fat-0-1","item":"BOM核对与物料齐套确认","content":"对照BOM清单逐项核对所有到货物资，确认型号/规格/数量/批次与BOM一致","standard":"BOM覆盖率100%","refStd":"GB/T 36548-2018","type":"关键","tool":"BOM清单/ERP系统","record":"物料齐套确认单"},
          {"id":"fat-0-2","item":"设备参数配置核查","content":"核对电池簇/PCS/BMS/EMS/HVB/DCPM参数与技术文件一致","standard":"参数一致性100%","refStd":"厂家技术规范","type":"关键","tool":"参数配置手册","record":"设备参数核对报告"},
          {"id":"fat-0-3","item":"保护定值清单校核","content":"核对过压/欠压/过流/过温/短路等保护定值与设计定值单一致，动作逻辑无冲突","standard":"定值偏差≤±1%","refStd":"GB/T 34131-2017","type":"关键","tool":"保护定值单","record":"保护定值校核确认单"},
          {"id":"fat-0-4","item":"内部走线目检通过","content":"动力线束/低压线束/通讯线束连接正确、无漏装松脱老化、正负极未反接、线标清晰","standard":"GB 50171-2024","refStd":"GB 50171-2024","type":"关键","tool":"目视法/电气接线图","record":"线束检查记录表"},
          {"id":"fat-0-5","item":"BMS/BAU固件版本确认","content":"登录BMS监控平台→BCU/BAU Info→查看版本号及MD5值，与目标版本清单一致","standard":"版本号+MD5匹配","refStd":"厂家技术规范","type":"关键","tool":"上位机/BMS调试软件","record":"固件版本确认单"},
          {"id":"fat-0-6","item":"测试设备校准有效期核查","content":"兆欧表(MIT525)/耐压仪/万用表/功率分析仪/热成像仪/扭矩扳手等计量设备在有效校准期内","standard":"校准证书有效期内(≤12个月)","refStd":"JJF 1033-2016","type":"关键","tool":"校准证书台账","record":"设备校准核查记录"},
          {"id":"fat-0-7","item":"工位5S清洁完毕","content":"FAT测试区域清扫干净、工具归位、无杂物堆放、通道畅通","standard":"工厂5S标准","refStd":"GB/T 19001-2016","type":"一般","tool":"目视法","record":"5S检查表"},
          {"id":"fat-0-8","item":"安全交底与作业许可","content":"明确高压区域/E-Stop位置/应急流程，签发FAT作业票、JSA工作安全分析","standard":"安全交底100%覆盖","refStd":"GB 30871-2022","type":"关键","tool":"安全交底记录表","record":"测试前安全交底记录"}
        ]},
      {"id":"fat-1","sortOrder":1,"name":"外观检查","standardHours":"0.5h","canParallel":false,"witness":"质检员/业主代表",
        "checks":[
          {"id":"fat-1-1","item":"预制舱舱体外观","content":"目视全舱表面：无凹陷/划伤/锈蚀/焊缝裂纹；螺栓紧固到位；铭牌清晰完整","standard":"GB/T 36276-2018 第5.2条","refStd":"GB/T 36276-2018","type":"关键","tool":"目视法/手电筒/涂层测厚仪","record":"外观检查记录表"},
          {"id":"fat-1-2","item":"门锁/铰链/密封条功能","content":"开关门3次，确认锁闭可靠无卡滞，密封条完好无脱落变形","standard":"IP54防护等级","refStd":"GB/T 4208-2017","type":"重要","tool":"目视法/手感测试","record":"外观检查记录表"},
          {"id":"fat-1-3","item":"电池簇外观清洁度","content":"电芯模组无脏秽损伤划痕，标识清晰正确，端子无氧化腐蚀","standard":"厂家技术规范","refStd":"厂家技术规范","type":"重要","tool":"目视法","record":"外观检查记录表"},
          {"id":"fat-1-4","item":"高压箱PDU/汇流柜外观","content":"清洁无秽物损伤锈蚀，铜排镀层良好，绝缘护套完整，标识齐全","standard":"GB/T 36276-2018","refStd":"GB/T 36276-2018","type":"关键","tool":"目视法","record":"外观检查记录表"},
          {"id":"fat-1-5","item":"PCS变流器外观","content":"模块无破损变形，散热器翅片无倒伏堵塞，接线端子无氧化松动","standard":"GB/T 36548-2018","refStd":"GB/T 36548-2018","type":"关键","tool":"目视法","record":"PCS外观检查表"},
          {"id":"fat-1-6","item":"液冷系统外检(TMS)","content":"管路无裂纹凹陷，阀门位置正确，风机/泵无移位松动破损，接头无漏液痕迹","standard":"厂家液冷规范","refStd":"厂家液冷规范","type":"重要","tool":"目视法/红外成像仪","record":"液冷外观检查表"},
          {"id":"fat-1-7","item":"消防系统外检(FFS)","content":"探测器/喷头无堵塞，管路无老化松动，灭火剂储量≥设计值90%，指示灯正常","standard":"GB 50116-2013","refStd":"GB 50116-2013","type":"关键","tool":"目视法/手电筒/消防烟枪","record":"消防外观检查表"},
          {"id":"fat-1-8","item":"铭牌/警示标识/接地标识","content":"设备铭牌参数清晰，高压警告牌/接地标识/操作指引张贴牢固正确","standard":"GB 2894-2024","refStd":"GB 2894-2024","type":"重要","tool":"目视法","record":"标识检查记录"}
        ]},
      {"id":"fat-2","sortOrder":2,"name":"绝缘测试","standardHours":"1h","canParallel":true,"witness":"质检员/测试工程师",
        "checks":[
          {"id":"fat-2-1","item":"电池簇绝缘(抽检20%)","content":"用兆欧表DC 1000V测量电芯模组正极/负极-外壳绝缘电阻","standard":"常温≥500MΩ;高温高湿≥0.5MΩ","refStd":"GB/T 36276-2018","type":"关键","tool":"兆欧表 DC 1000V (MIT525)","record":"绝缘测试记录表"},
          {"id":"fat-2-2","item":"RACK级绝缘(全检)","content":"兆欧表DC 2500V测量总正/总负-地(机架)绝缘电阻","standard":"≥100MΩ (GB 50150-2016)","refStd":"GB 50150-2016","type":"关键","tool":"兆欧表 DC 2500V (MIT525)","record":"绝缘测试记录表"},
          {"id":"fat-2-3","item":"BANK级绝缘","content":"兆欧表DC 2500V测量正母排-负母排、相-地绝缘；地阻仪测量柜体接地电阻","标准":"母排间≥100MΩ;相-地≥100MΩ;接地≤4Ω","refStd":"GB 50150-2016","type":"关键","tool":"兆欧表2500V+地阻仪(0-200Ω)","record":"绝缘测试记录表"},
          {"id":"fat-2-4","item":"DCPM高压箱绝缘(全检)","content":"直流输入正/负-PE、控制电源端子-PE绝缘电阻","standard":"直流侧≥100MΩ;控制侧≥10MΩ (GB 50150-2016)","refStd":"GB 50150-2016","type":"关键","tool":"兆欧表 DC 2500V (MIT525)","record":"绝缘测试记录表"},
          {"id":"fat-2-5","item":"PCS绝缘(全检)","content":"DC侧正/负-地、AC侧L1/L2/L3-地、通讯信号线-地绝缘","standard":"DC/AC侧≥100MΩ;信号线≥10MΩ","refStd":"GB 50150-2016","type":"关键","tool":"兆欧表(DC 2500V/AC 1000V)","record":"绝缘测试记录表"},
          {"id":"fat-2-6","item":"环境修正记录","content":"记录测试时环境温度/湿度，必要时按温度系数修正读数","standard":"温度23±5℃;湿度<80%RH","refStd":"DL/T 993-2024","type":"一般","tool":"温湿度计","record":"环境记录表"}
        ]},
      {"id":"fat-3","sortOrder":3,"name":"耐压试验","standardHours":"1.5h","canParallel":false,"witness":"质检员/测试工程师",
        "checks":[
          {"id":"fat-3-1","item":"耐压试验前绝缘复测","content":"确认绝缘电阻合格后方可进行耐压试验，严禁不合格品上耐压","standard":"绝缘≥耐压前值的90%","refStd":"GB 50150-2016","type":"关键","tool":"兆欧表 DC 2500V","record":"耐压前绝缘复测表"},
          {"id":"fat-3-2","item":"直流侧耐压试验(DC-PE)","content":"对直流主回路施加规定耐压电压(如DC 2500V/1min)，无击穿/闪络","standard":"GB 50150-2016 耐压要求","refStd":"GB 50150-2016","type":"关键","tool":"耐压测试仪(AC 2kV以上)","record":"耐压测试记录表"},
          {"id":"fat-3-3","item":"交流侧耐压试验(AC-PE)","content":"对交流侧施加工频耐压(如AC 2kV/1min)，无击穿/闪络/异常声响","standard":"GB 50150-2016 耐压要求","refStd":"GB 50150-2016","type":"关键","tool":"耐压测试仪(AC输出)","record":"耐压测试记录表"},
          {"id":"fat-3-4","item":"泄漏电流检测","content":"耐压过程中监测泄漏电流值不超过允许限值","standard":"≤10mA(或设备额定值)","refStd":"GB/T 16935.1-2024","type":"关键","tool":"耐压测试仪(带泄漏电流显示)","record":"耐压测试记录表"},
          {"id":"fat-3-5","item":"耐压后绝缘复测","content":"耐压结束后立即复测绝缘电阻，应不低于试验前的90%","standard":"≥试验前值×90%","refStd":"GB 50150-2016","type":"关键","tool":"兆欧表 DC 2500V (MIT525)","record":"耐压后绝缘复测表"},
          {"id":"fat-3-6","item":"耐压安全措施确认","content":"试验区域设警戒隔离、专人监护、急停可用、试验后充分放电","standard":"安全规程执行100%","refStd":"GB 30871-2014","type":"关键","tool":"警戒带/放电棒","record":"安全确认签字"}
        ]},
      {"id":"fat-4","sortOrder":4,"name":"BMS测试","standardHours":"2h","canParallel":true,"witness":"BMS工程师/质检员",
        "checks":[
          {"id":"fat-4-1","item":"BCU版本号及MD5核查","content":"登录BMS监控平台→设备管理→BCU Info→逐台比对版本号和MD5哈希值","standard":"与发布清单100%一致","refStd":"厂家技术规范","type":"关键","tool":"上位机/BMS调试软件","record":"BMS版本确认单"},
          {"id":"fat-4-2","item":"电压采集精度验证","content":"用6位半万用表实测单体/簇电压，与BMS显示值对比计算采集误差","standard":"误差≤±20mV (GB/T 34131-2017)","refStd":"GB/T 34131-2017","type":"关键","tool":"数字万用表(1500VDC,6位半)","record":"BMS采集精度测试表"},
          {"id":"fat-4-3","item":"温度采集精度验证","content":"用红外测温仪/模拟热源实测电芯温度，与BMS采集值对比","standard":"误差≤±2℃","refStd":"GB/T 34131-2017","type":"重要","tool":"红外测温仪(-20~500℃)","record":"BMS采集精度测试表"},
          {"id":"fat-4-4","item":"SOC/SOH标定验证","content":"OCV开路电压法标定初始SOC，SOH估算合理性检查","standard":"SOC误差≤±1%","refStd":"GB/T 34131-2017","type":"关键","tool":"上位机/BMS调试软件","record":"SOC标定记录表"},
          {"id":"fat-4-5","item":"均衡功能点检","content":"主动/被动均衡投切逻辑验证，均衡电流符合规格","standard":"均衡动作正常、电流偏差≤±5%","refStd":"厂家技术规范","type":"重要","tool":"上位机/BMS调试软件","record":"均衡功能测试表"},
          {"id":"fat-4-6","item":"保护功能验证(单体级)","content":"模拟过压/欠压/过温/欠温故障，验证BMS保护动作及时准确","standard":"响应时间≤100ms;动作逻辑合规","refStd":"GB/T 34131-2017","type":"关键","tool":"信号发生器/上位机","record":"保护功能测试表"},
          {"id":"fat-4-7","item":"CAN总线通信验证","content":"ZLG CAN盒监听BCU CAN报文帧ID/周期/DLC/数据域完整性","standard":"丢包率≤0.1%;帧周期稳定","refStd":"ISO 11898-1:2015","type":"重要","tool":"ZLG CAN盒(USBCAN-2E-U)","record":"CAN通信测试记录"},
          {"id":"fat-4-8","item":"BAU通信与数据汇总","content":"BAU对各BCU数据汇总上报EMS验证，拓扑识别正确","standard":"簇数量一致;通信延迟≤100ms","refStd":"厂家技术规范","type":"关键","tool":"上位机/网络工具","record":"BAU通信测试记录"}
        ]},
      {"id":"fat-5","sortOrder":5,"name":"TMS测试","standardHours":"1.5h","canParallel":true,"witness":"TMS工程师/质检员",
        "checks":[
          {"id":"fat-5-1","item":"管路气密性测试","content":"充氮保压(0.2MPa)保持30min，压力降≤5%","standard":"压力降≤5%","refStd":"GB/T 20801.1-2020","type":"关键","tool":"氮气瓶/压力表/检漏液","record":"气密性测试记录"},
          {"id":"fat-5-2","item":"乙二醇水溶液加注","content":"真空注液机定量加注40%乙二醇水溶液至规定液位","standard":"浓度40%±2%;液位在刻度范围内","refStd":"厂家液冷规范","type":"关键","tool":"真空注液机(ZDJ-ZL-500)","record":"冷媒加注记录"},
          {"id":"fat-5-3","item":"流量测试","content":"启动循环泵，各支路流量符合设计值(偏差≤±10%)","标准":"流量偏差≤±10%","refStd":"GB/T 32107-2015","type":"关键","tool":"超声波流量计","record":"流量测试记录"},
          {"id":"fat-5-4","item":"温控精度验证","content":"设定不同目标温度(15/25/35℃)，实际进出口温差≤±2℃","standard":"控温精度±2℃","refStd":"NB/T 42132-2018","type":"重要","item":"温度巡检仪/热电偶","record":"温控精度测试表"},
          {"id":"fat-5-5","item":"漏液检测功能验证","content":"模拟管道接口微量泄漏，确认传感器报警触发且定位准确","standard":"报警触发时间≤30s","refStd":"GB/T 36995-2019","type":"关键","tool":"模拟泄漏装置/上位机","record":"漏液检测测试表"},
          {"id":"fat-5-6","item":"TMS控制逻辑验证","content":"泵启停联锁、低流量保护、高低温报警、紧急排水阀动作","standard":"全部逻辑动作正确","refStd":"厂家液冷规范","type":"重要","tool":"上位机/TMS调试软件","record":"TMS逻辑验证表"}
        ]},
      {"id":"fat-6","sortOrder":6,"name":"FFS测试","standardHours":"0.5h","canParallel":true,"witness":"消防工程师/质检员",
        "checks":[
          {"id":"fat-6-1","item":"烟感探测器灵敏度测试","content":"消防烟枪引入标准烟，探测器应在规定时间内(≤30s)报警","standard":"响应时间≤30s (GB 50116-2013)","refStd":"GB 50116-2013","type":"关键","tool":"消防烟枪/秒表","record":"消防探测器测试表"},
          {"id":"fat-6-2","item":"温感探测器灵敏度测试","content":"热风枪模拟升温，温感探测器按规定阈值(58℃/70℃)触发报警","standard":"响应时间≤60s","refStd":"GB 50116-2013","type":"关键","tool":"热风枪/温度计","record":"消防探测器测试表"},
          {"id":"fat-6-3","item":"灭火装置启动测试","content":"手动触发灭火装置(或模拟火警自动触发)，确认药剂释放/喷淋正常","standard":"释放延迟≤10s;覆盖范围达标","refStd":"GB 50163-2015","type":"关键","tool":"手动触发按钮/观察","record":"灭火装置测试表"},
          {"id":"fat-6-4","item":"联动信号验证","content":"消防控制器→BMS/PCS/EMS的硬接点/Modbus联动信号传输正确","standard":"信号状态与实际一致","refStd":"GB 50116-2013","type":"关键","tool":"万用表/Modscan32","record":"联动信号测试表"},
          {"id":"fat-6-5","item":"声光报警器功能","content":"触发报警后声光报警器正常工作，声音≥75dB(A)，闪烁频率正确","standard":"声压级≥75dB(A);闪光正常","refStd":"GB 50166-2019","type":"重要","tool":"声级计/目视","record":"声光报警测试表"},
          {"id":"fat-6-6","item":"灭火剂储量确认","content":"确认七氟丙烷/全氟己酮等灭火剂充装量≥设计值90%","standard":"储量≥90%","refStd":"GB 16670-2018","type":"关键","工具":"称重/压力表","record":"灭火剂储量记录"}
        ]},
      {"id":"fat-7","sortOrder":7,"name":"通讯测试","standardHours":"0.5h","canParallel":true,"witness":"通讯工程师/质检员",
        "checks":[
          {"id":"fat-7-1","item":"Modbus TCP/IP通信","content":"EMS通过Modbus TCP读写PCS/BMS寄存器，响应时间和数据正确性","standard":"响应<500ms;数据准确","refStd":"GB/T 19582-2008","type":"关键","tool":"Modbus Poll/网络测试仪","record":"Modbus通信测试表"},
          {"id":"fat-7-2","item":"CAN总线通信(BMS-PCS)","content":"BMS与PCS之间CAN报文交互，帧ID/数据域/周期符合协议定义","standard":"帧周期稳定;无错误帧","refStd":"ISO 11898-1:2015","type":"关键","tool":"ZLG CAN盒(USBCAN-2E-U)","record":"CAN通信测试记录"},
          {"id":"fat-7-3","item":"硬接点IO信号核对","content":"逐一测量DI/DO信号状态(运行/故障/告警/就绪)，与图纸一致","standard":"IO状态100%匹配","refStd":"GB/T 5094-2018","type":"关键","tool":"万用表/示波器","record":"IO信号核对表"},
          {"id":"fat-7-4","item":"以太网口/网线测试","content":"RJ45网线通断/线序/衰减测试，交换机端口LED状态正常","标准":"网线衰减<标准限值;通断100%","refStd":"YD/T 1019-2013","type":"重要","tool":"网线测试仪(RJ45)","record":"网络测试记录"},
          {"id":"fat-7-5","item":"RS485通信(仪表/传感器)","content":"RS485总线上的智能电表/温度传感器/流量计数据读取正常","standard":"读数准确;无乱码/超时","refStd":"GB/T 18657.3-2002","type":"重要","tool":"CM383转接器/串口助手","record":"RS485通信测试表"},
          {"id":"fat-7-6","item":"SCADA/EMS画面验证","content":"EMS人机界面各测点数值刷新正常，告警弹窗/历史曲线/报表生成","standard":"画面刷新<2s;告警实时推送","refStd":"GB/T 50823-2013","type":"重要","tool":"上位机/EMS客户端","record":"EMS画面验收单"}
        ]},
      {"id":"fat-8","sortOrder":8,"name":"充放电测试","standardHours":"0.75h","canParallel":false,"witness":"测试工程师/业主代表",
        "checks":[
          {"id":"fat-8-1","item":"短时充电测试","content":"以0.2P恒功率充电10min，验证充电电流/电压/SOC变化正常","standard":"充电功率稳定在0.2P±5%","refStd":"GB/T 36548-2018","type":"关键","tool":"直流电源/功率分析仪","record":"充电测试记录表"},
          {"id":"fat-8-2","item":"短时放电测试","content":"以0.2P恒功率放电10min，验证放电性能正常","standard":"放电功率稳定在0.2P±5%","refStd":"GB/T 36548-2018","type":"关键","tool":"电子负载/功率分析仪","record":"放电测试记录表"},
          {"id":"fat-8-3","item":"充放电转换测试","content":"充电→静置→放电模式切换，过渡过程平稳无冲击","standard":"切换时间≤5s;无过冲/震荡","refStd":"GB/T 36548-2018","type":"关键","tool":"功率分析仪/示波器","record":"充放电转换测试表"},
          {"id":"fat-8-4","item":"效率粗算","content":"根据充放电能量积分计算往返效率(初步评估)","standard":"往返效率≥88%(初步)","refStd":"GB/T 36548-2018","type":"重要","tool":"功率分析仪/BMS上位机","record":"效率测试记录表"},
          {"id":"fat-8-5","item":"热分布检查","content":"充放电过程中红外热成像扫描，热点温升≤15K","refStd":"GB/T 36995-2019","标准":"最大温升≤15K;无局部热点","type":"重要","tool":"红外热成像仪","record":"热成像报告"},
          {"id":"fat-8-6","item":"保护功能联调(PCS-BMS)","content":"模拟过压/欠压/过流/通信中断，验证PCS-BMS联合保护动作","standard":"保护拒动率=0;误动率=0","refStd":"GB/T 36548-2018","type":"关键","tool":"信号发生器/上位机","record":"联调保护测试表"}
        ]},
      {"id":"fat-9","sortOrder":9,"name":"包装检查","standardHours":"0.5h","canParallel":true,"witness":"质检员/物流专员",
        "checks":[
          {"id":"fat-9-1","item":"包装箱体完整性","content":"木箱/钢架无破损开裂，钉合牢固，尺寸符合装箱图","refStd":"GB/T 4768-2008","standard":"无可见破损;尺寸公差±10mm","type":"关键","tool":"卷尺/目视","record":"包装检查记录表"},
          {"id":"fat-9-2","item":"海运标识检查","content":"唛头/箱号/毛净体积/重心/吊装点/防雨/易碎/向上标识完整正确","refStd":"GB/T 191-2008","standard":"标识覆盖率100%","type":"重要","tool":"目视/ checklist","record":"包装标识检查表"},
          {"id":"fat-9-3","item":"固定与防护","content":"设备与箱体间缓冲材料填充充足，绑扎带/螺栓紧固力矩达标","refStd":"GB/T 5398-2015","standard":"无晃动间隙;绑扎牢固","type":"关键","tool":"目视/手推/力矩扳手","record":"固定防护检查表"},
          {"id":"fat-9-4","item":"干燥剂/防潮措施","content":"集装箱内干燥剂投放量足够(每立方米≥2袋)，防潮膜密封良好","refStd":"GB/T 5048-2017","standard":"干燥剂量达标;密封完好","type":"重要","tool":"目视/清点","record":"防潮检查表"},
          {"id":"fat-9-5","item":"随箱附件清点","content":"备品备件/随机文件/专用工具/钥匙/密码单齐全并封存于附件箱","refStd":"GB/T 13384-2008","standard":"附件100%齐套","type":"关键","tool":"附件清单/清点","record":"附件清点记录表"},
          {"id":"fat-9-6","item":"装箱单签署","content":"三方(生产/质检/物流)核对装箱内容无误后在装箱单签字","refStd":"GB/T 13384-2008","standard":"三方签字完整","type":"关键","tool":"装箱单","record":"装箱单原件"}
        ]}
    ],
    "specs":{"ratedEnergy":"5016 kWh","ratedPower":"1250 kW","voltage":"1500 Vdc","weight":"约45T","dimensions":"6.058×2.438×2.896m","cooling":"液冷(40%乙二醇水溶液)","cell":"314Ah LFP"},"totalStandardHours":"9.25h",
    "sevenM1E":{"人":"质检员/测试工程师/BMS工程师/持证电工/TMS工程师/消防工程师/通讯工程师","机":"兆欧表MIT525(DC 2500V)、耐压测试仪(AC 2kV)、6位半万用表(1500VDC)、功率分析仪、红外热成像仪(-20~500℃)、ZLG CAN盒(USBCAN-2E-U)、数显扭矩扳手(CNB100)、钳形电流表(1000A)、网线测试仪(RJ45)、消防烟枪/热风枪、超声波流量计、真空注液机(ZDJ-ZL-500)、CM383转接器","料":"测试记录表全套(外观/绝缘/耐压/BMS/液冷/消防/通讯/充放电/包装)、校准证书、备品备件清单、安全警示带/牌、干燥剂/缓冲材料","法":"GB 50150-2016/ GB/T 34131-2017/ GB/T 36276-2018/ GB/T 36548-2018/ GB 50116-2013/ GB/T 36995-2019 + 厂家操作规程/FAT测试方案","环":"工厂车间环境: 温度10-35℃、湿度<80%RH、洁净度良好、通风照明充足","测":"绝缘电阻(≥100MΩ)、耐压(无击穿/闪络)、泄漏电流(≤10mA)、电压采集误差(±20mV)、温度采集误差(±2℃)、流量偏差(±10%)、温控精度(±2℃)、充放电效率(≥88%)、温升(≤15K)","管理":"项目经理统筹、质量经理审批FAT计划、班前会安全交底、作业票签发、JSA工作安全分析、FAT邀请函提前2周发客户","能源":"工厂供电380V AC三相五线制、临时用电三级箱配置、测试设备用电负荷核算(≤50kW)"}
  };

  // ========== 研发SOP（新品研发·内嵌·8阶段）==========
  const EMBEDDED_RD_SOP = {
    "phases": [
      // ===== RD Phase 1: 客户需求确认 =====
      {"id":"rd-1","sortOrder":1,"name":"1.1 客户需求确认","standardHours":"40h","canParallel":false,"witness":"销售总监/系统架构师",
        "checks":[
          {"id":"rd-1-1","item":"市场需求分析","content":"分析目标市场的政策导向、客户需求、竞争格局、技术趋势","standard":"输出市场需求分析报告(≥5家客户访谈)","type":"关键","tool":"市场调研模板/CRM数据","refStd":"GB/T 19001-2016","record":"市场需求分析报告"},
          {"id":"rd-1-2","item":"技术规格确认","content":"确认电气参数(电压/容量/功率)、环境适应性(温湿度/海拔/腐蚀)、并网要求","standard":"技术规格书(SRS)签署通过","type":"关键","tool":"SRS模板/需求追踪矩阵(RTM)","refStd":"GB/T 36544-2018","record":"技术规格书(SRS)"},
          {"id":"rd-1-3","item":"客户需求追踪矩阵(RTM)","content":"建立需求ID→设计→测试→验收的全链路追踪矩阵","standard":"需求覆盖率100%;可追溯率100%","type":"关键","tool":"DOORS/Reqtify","refStd":"GB/T 11457-2006","record":"需求追踪矩阵(RTM)"},
          {"id":"rd-1-4","item":"投资回报分析(ROI)","content":"计算CAPEX/OPEX/IRR/投资回收期，输出经济性评估报告","standard":"ROI≥8%;投资回收期≤8年","type":"重要","tool":"Excel财务模型/NPV计算器","refStd":"GB/T 50858-2013","record":"投资回报分析报告"}
        ],
        "risks":[
          {"level":"high","text":"需求理解偏差→引入需求评审机制(客户/售前/研发三方会签)"},
          {"level":"medium","text":"需求变更频繁→定义需求变更控制流程(CCB)"}
        ],
        "collab":[
          {"item":"客户需求输入", "owner":"销售部", "deadline":"项目启动前", "status":"pending"},
          {"item":"技术方案可行性预评估", "owner":"系统架构师", "deadline":"需求确认后3日", "status":"pending"}
        ]
      },
      // ===== RD Phase 2: 概念设计评审 =====
      {"id":"rd-2","sortOrder":2,"name":"1.2 概念设计评审","standardHours":"80h","canParallel":false,"witness":"CTO/首席工程师",
        "checks":[
          {"id":"rd-2-1","item":"系统架构设计","content":"确定电气拓扑(直流侧+交流侧)、BMS架构(主/从控)、热管理方案(液冷/风冷)、消防方案","standard":"系统架构图+设计方案通过评审","type":"关键","tool":"Visio/AutoCAD","refStd":"GB/T 36544-2018","record":"系统架构设计方案"},
          {"id":"rd-2-2","item":"关键器件选型","content":"电芯(314Ah/280Ah)、PCS(集中式/组串式)、BMS(主动均衡/被动均衡)、消防(全氟己酮/气溶胶)选型","standard":"BOM关键器件清单+规格书","type":"关键","tool":"器件规格书/选型表","refStd":"GB/T 36276-2018","record":"关键器件选型报告"},
          {"id":"rd-2-3","item":"概念设计评审(CDR)","content":"对系统架构/器件选型/热管理/安全设计的完整性/合理性/可制造性进行评审","standard":"CDR评审报告签署(Score≥80分)","type":"关键","tool":"评审检查表(Checklist)","refStd":"GB/T 19001-2016","record":"概念设计评审报告(CDR)"},
          {"id":"rd-2-4","item":"专利侵权风险分析","content":"检索竞品专利(电芯/PACK/BMS/系统)，评估侵权风险，制定规避设计","standard":"专利侵权风险评估报告(FTO)","type":"重要","tool":"专利检索数据库(CNIPA)","refStd":"专利法规定","record":"专利侵权风险评估报告"},
          {"id":"rd-2-5","item":"初步DFMEA(设计失效模式)","content":"识别TOP10设计风险(热失控扩散/绝缘失效/通讯中断等)，制定预防措施","standard":"DFMEA严重度(S)≤8;RPN≤100","type":"关键","tool":"FMEA模板/风险矩阵","refStd":"AIAG FMEA手册","record":"初步DFMEA报告"}
        ],
        "risks":[
          {"level":"high","text":"架构设计缺陷→引入外部专家评审+类比竞品"},
          {"level":"medium","text":"关键器件供货风险→AVL(合格供应商清单)提前确认+长周期器件预下单"}
        ],
        "collab":[
          {"item":"概念设计评审会", "owner":"研发总监", "deadline":"概念设计完成后", "status":"pending"},
          {"item":"专利检索报告", "owner":"知识产权部", "deadline":"CDR前", "status":"pending"}
        ]
      },
      // ===== RD Phase 3: 详细设计 =====
      {"id":"rd-3","sortOrder":3,"name":"1.3 详细设计","standardHours":"200h","canParallel":true,"witness":"研发总监/模块化负责人",
        "checks":[
          {"id":"rd-3-1","item":"电气原理图设计","content":"完成高低压电气原理图(主回路/控制回路/通讯回路/BMS采集回路)，通过电气评审","standard":"原理图错误率≤0.1%","type":"关键","tool":"EPLAN/CAD","refStd":"GB/T 4728-2018","record":"电气原理图+评审记录"},
          {"id":"rd-3-2","item":"PCB设计(3D布板)","content":"BMS主控板/从控板PCB设计(6层板+阻抗控制)，3D布板干涉检查","standard":"PCB DFM检查通过;信号完整性仿真通过","type":"关键","tool":"Altium Designer/Signal Integrity","refStd":"IPC-2221B","record":"PCB设计文件(Gerber)"},
          {"id":"rd-3-3","item":"结构设计与强度仿真","content":"PACK/机柜/集装箱结构强度(CAE)/刚度/模态/疲劳分析，安全系数≥2.0","standard":"FEM应力≤材料屈服强度/2","type":"关键","tool":"SolidWorks Simulation/Ansys","refStd":"GB/T 3811-2008","record":"结构强度仿真报告"},
          {"id":"rd-3-4","item":"热管理设计(CFD仿真)","content":"液冷系统流场/温度场CFD仿真，验证最恶劣工况下温差≤5K","standard":"CFD最高温度≤电芯允许温度-5K","type":"关键","tool":"Fluent/Star-CCM+","refStd":"GB/T 11087-2016","record":"热管理CFD仿真报告"},
          {"id":"rd-3-5","item":"BMS控制策略与算法设计","content":"SOC/SOH/SOE估算算法、热管理控制策略、故障诊断树、均衡策略设计","standard":"算法Matlab仿真通过;精度SOC≤3%","type":"关键","tool":"Matlab/Simulink","refStd":"GB/T 34131-2017","record":"BMS控制策略设计报告"},
          {"id":"rd-3-6","item":"图纸发布(受控)","content":"电气图/结构图/ BOM全部受控发布(版本A.0)，变更需ECR流程","standard":"图纸受控率100%;版本可追溯","type":"关键","tool":"PLM/EDM系统","refStd":"GB/T 19001-2016","record":"受控图纸清单+发布记录"},
          {"id":"rd-3-7","item":"详细设计评审(DDR)","content":"对详细设计的完整性/正确性/可制造性/可测试性进行全面评审","standard":"DDR评审报告签署(Score≥85分)","type":"关键","tool":"评审检查表","refStd":"GB/T 19001-2016","record":"详细设计评审报告(DDR)"}
        ],
        "risks":[
          {"level":"high","text":"设计接口不协调→建立跨模块设计接口协调会(每周)"},
          {"level":"medium","text":"设计变更频繁→冻结前完成3轮设计自查"}
        ],
        "collab":[
          {"item":"电气原理图评审", "owner":"电气负责人", "deadline":"原理图完成后", "status":"pending"},
          {"item":"结构图纸会签", "owner":"结构负责人", "deadline":"图纸发布前", "status":"pending"},
          {"item":"BMS算法仿真验证", "owner":"BMS工程师", "deadline":"算法设计完成后", "status":"pending"}
        ]
      },
      // ===== RD Phase 4: 型式试验 =====
      {"id":"rd-4","sortOrder":4,"name":"1.4 型式试验","standardHours":"300h","canParallel":false,"witness":"测试经理/CNAS实验室",
        "checks":[
          {"id":"rd-4-1","item":"电性能测试","content":"容量、能量效率、充放电倍率、电压/温度采集精度、绝缘电阻测试","standard":"容量偏差≤±3%;效率≥88%","type":"关键","tool":"充放电柜/万用表/兆欧表","refStd":"GB/T 36276-2018","record":"电性能测试报告"},
          {"id":"rd-4-2","item":"环境适应性测试","content":"高温(+55℃)/低温(-30℃)/湿热(95%RH)/温度冲击/盐雾(96h)测试","standard":"测试后功能正常;容量保持率≥90%","type":"关键","tool":"环境试验箱/盐雾箱","refStd":"GB/T 2423-2016","record":"环境适应性测试报告"},
          {"id":"rd-4-3","item":"循环寿命测试","content":"1C/1C充放电循环≥6000次(80%SOH)，测试周期约6-12个月","standard":"循环次数≥规格书承诺值","type":"关键","tool":"循环测试柜/数据记录仪","refStd":"GB/T 36276-2018","record":"循环寿命测试报告"},
          {"id":"rd-4-4","item":"安全性能测试","content":"过充/过放/短路/挤压/针刺/跌落/热失控扩散测试","standard":"安全测试通过(无起火/爆炸)","type":"关键","tool":"安全测试平台/摄像机","refStd":"GB/T 36276-2018 / GB 38031-2020","record":"安全性能测试报告"},
          {"id":"rd-4-5","item":"EMC测试","content":"辐射发射(RE)/传导发射(CE)/辐射抗扰度(RS)/传导抗扰度(CS)测试","standard":"EMC等级达标(Class A)","type":"重要","tool":"EMC暗室/测试设备","refStd":"GB/T 17626-2018","record":"EMC测试报告"},
          {"id":"rd-4-6","item":"型式试验报告编制","content":"汇总所有测试数据，编制型式试验报告，提交内部评审","standard":"报告完整性100%;数据可追溯","type":"关键","tool":"测试数据管理系统","refStd":"GB/T 36276-2018","record":"型式试验报告(完整版)"}
        ],
        "risks":[
          {"level":"high","text":"测试周期长→并行安排电性能+环境测试;循环寿命用加速模型"},
          {"level":"high","text":"测试失败→预测试+设计余量(电压/温度/安全)"},
          {"level":"medium","text":"测试资源冲突→提前6个月预约CNAS实验室"}
        ],
        "collab":[
          {"item":"测试方案评审", "owner":"测试经理", "deadline":"测试前", "status":"pending"},
          {"item":"样品准备(3台)", "owner":"制造部", "deadline":"测试前2周", "status":"pending"},
          {"item":"测试进度周报", "owner":"测试工程师", "deadline":"每周", "status":"pending"}
        ]
      },
      // ===== RD Phase 5: 样品试制 =====
      {"id":"rd-5","sortOrder":5,"name":"1.5 样品试制","standardHours":"160h","canParallel":true,"witness":"工艺主管/制造经理",
        "checks":[
          {"id":"rd-5-1","item":"试制工艺文件编制","content":"作业指导书(SOP/WI)、工艺流程图(PFC)、控制计划(CP)、PFMEA更新","standard":"工艺文件覆盖率100%(全工序)","type":"关键","tool":"工艺模板库/Visio","refStd":"GB/T 19001-2016","record":"试制工艺文件包"},
          {"id":"rd-5-2","item":"工装夹具设计与制作","content":"装配夹具、测试治具、周转工装的设计加工验收","standard":"工装精度满足CPK≥1.33","type":"重要","tool":"SolidWorks/加工设备","refStd":"GB/T 4863-2008","record":"工装验收报告"},
          {"id":"rd-5-3","item":"首件检验(FAI)实施","content":"对首批3-5台样品进行FAI：尺寸/外观/功能/安规100%全检","standard":"FAI合格率100%","type":"关键","tool":"CMM/万用表/功能测试台","refStd":"GB/T 2828.1-2012","record":"首件检验报告(FAI)"},
          {"id":"rd-5-4","item":"样品功能性能验证","content":"按产品规格书逐项验证功能完整性、性能达标性","standard":"关键性能项100%满足SRS","type":"关键","tool":"功能测试台/充放电柜","refStd":"GB/T 36544-2018","record":"样品验证测试报告(VVR)"},
          {"id":"rd-5-5","item":"试制问题闭环(TR)","content":"汇总试制过程中发现的设/工/料问题，制定改进措施并验证","standard":"问题关闭率100%(30日内)","type":"关键","tool":"问题追踪系统/8D报告","refStd":"GB/T 2828.1-2012 / 8D方法","record":"试制问题追踪表+8D报告"},
          {"id":"rd-5-6","item":"小批量试产(PVT)评审","content":"PVT生产完成后的产量/质量/效率/成本全面评审","standard":"直通率FPY≥90%;产能达标率≥85%","type":"关键","tool":"生产报表/质量统计","refStd":"GB/T 19001-2016","record":"PVT评审报告"}
        ],
        "risks":[
          {"level":"high","text":"试制问题多发→强化工艺评审+预生产"},
          {"level":"medium","text":"供应链齐套率低→长周期器件提前备料"}
        ],
        "collab":[
          {"item":"试制BOM领料单", "owner":"PMC", "deadline":"试制前", "status":"pending"},
          {"item":"生产线体准备就绪", "owner":"制造工程", "deadline":"试制前", "status":"pending"},
          {"item":"操作员培训考核记录", "owner":"HR/培训", "deadline":"试制前", "status":"pending"}
        ]
      },
      // ===== RD Phase 6: 产品认证 =====
      {"id":"rd-6","sortOrder":6,"name":"1.6 产品认证","standardHours":"200h","canParallel":false,"witness":"认证经理/质量总监",
        "checks":[
          {"id":"rd-6-1","item":"GB/T 36276-2018 单体认证","content":"按照GB/T 36276要求进行电性能、循环寿命、安全性能全套测试","standard":"所有测试项通过CNAS实验室认证","type":"关键","tool":"CNAS认证实验室/测试设备","refStd":"GB/T 36276-2018","record":"GB/T 36276认证报告"},
          {"id":"rd-6-2","item":"GB/T 34131-2017 BMS认证","content":"BMS功能安全、电气安全、EMC测试认证","standard":"BMS认证通过，符合GB/T 34131","type":"关键","tool":"EMC测试室/安全实验室","refStd":"GB/T 34131-2017 / GB/T 17626","record":"BMS认证报告"},
          {"id":"rd-6-3","item":"IEC 62619 国际认证","content":"出口产品需通过IEC 62619固定式储能系统安全要求认证","standard":"IEC 62619认证证书获取","type":"关键","tool":"TÜV/SGS等国际认证机构","refStd":"IEC 62619:2022","record":"IEC 62619认证证书"},
          {"id":"rd-6-4","item":"UL 9540/UL 1973 北美认证","content":"北美市场需通过UL 9540(储能系统)和UL 1973(电池)认证","standard":"UL认证通过，获得ETL标志","type":"关键","tool":"UL授权实验室","refStd":"UL 9540:2022 / UL 1973:2022","record":"UL认证报告及证书"},
          {"id":"rd-6-5","item":"UN 38.3 运输安全认证","content":"电池运输安全测试(高度模拟、温度试验、振动、冲击、外短路、撞击、过充、强制放电)","standard":"UN 38.3测试报告+MSDS","type":"关键","tool":"危险品运输实验室","refStd":"UN 38.3 Rev.7","record":"UN 38.3测试报告+空运/海运鉴定书"},
          {"id":"rd-6-6","item":"CE认证(欧盟)","content":"LVD(低电压)、EMC(电磁兼容)、RoHS(有害物质)认证","standard":"CE符合性声明+公告机构证书","type":"重要","tool":"欧盟公告机构","refStd":"EN IEC 62477-1 / EN 61000","record":"CE认证证书"},
          {"id":"rd-6-7","item":"消防认证(CCCF)","content":"储能系统消防部件(探测、报警、灭火)通过CCCF认证","standard":"CCCF证书获取","type":"关键","tool":"消防检测中心","refStd":"GB 4715-2005 / GB 4716-2005","record":"CCCF认证证书"},
          {"id":"rd-6-8","item":"并网认证(CGC)","content":"储能系统并网性能测试认证(电能质量、电网支撑、保护配合)","standard":"CGC并网认证证书","type":"关键","tool":"中国电科院/并网检测中心","refStd":"GB/T 36547-2018 / NB/T 31016","record":"并网认证报告"}
        ],
        "risks":[
          {"level":"high","text":"认证周期长(6-12个月)→提前规划认证时间窗口，并行安排多项认证"},
          {"level":"medium","text":"认证标准更新→密切关注标准动态，预留标准变更应对时间"},
          {"level":"medium","text":"认证失败风险→选择经验丰富的认证机构，提前预测试"}
        ],
        "collab":[
          {"item":"认证机构选择与合同签署","owner":"采购/质量","deadline":"设计阶段","status":"pending"},
          {"item":"样品准备与送检","owner":"研发/制造","deadline":"认证前","status":"pending"},
          {"item":"认证进度每周同步","owner":"认证经理","deadline":"每周","status":"pending"},
          {"item":"认证证书归档与维护","owner":"质量工程师","deadline":"获证后","status":"pending"}
        ]
      },
      // ===== RD Phase 7: 正式上线 =====
      {"id":"rd-7","sortOrder":7,"name":"1.7 正式上线","standardHours":"40h","canParallel":false,"witness":"总经理/运营总监",
        "checks":[
          {"id":"rd-7-1","item":"量产准备评审(MRR)通过","content":"人(培训)/机(设备)/料(BOM)/法(工艺)/环(5S)五要素就绪确认","standard":"MRR checklist全部OK","type":"关键","tool":"MRR检查表","refStd":"APQP PPAP手册","record":"量产准备评审报告"},
          {"id":"rd-7-2","item":"正式BOM发布与版本锁定","content":"发布量产版BOM(P-BOM)，所有物料编码/版本/供应商锁定","standard":"BOM准确率99.9%+版本受控","type":"关键","tool":"ERP/PLM","refStd":"GB/T 19001-2016","record":"正式BOM发布通知单"},
          {"id":"rd-7-3","item":"生产工艺文件正式发布","content":"SOP/WI/CP/SIP全套工艺文件受控发布至产线","standard":"现场使用文件为最新受控版","type":"关键","tool":"文档控制系统(DMS)","refStd":"GB/T 19001-2016","record":"工艺文件发放记录"},
          {"id":"rd-7-4","item":"质量控制计划(QCP)生效","content":"进料(IQC)、过程(IPQC)、终检(FQC/OQC)控制计划和检验规范(SIP)生效","standard":"QCP覆盖率100%工序","type":"关键","tool":"QCP模板","refStd":"GB/T 19001-2016 / APQP","record":"质量控制计划(QCP)"},
          {"id":"rd-7-5","item":"首批量产产品质量回顾(LRR)","content":"首批量产(≥50台)的质量/效率/成本/交付全面回顾","standard":"FPY≥95%; ODD≤500ppm","type":"关键","tool":"质量统计工具","refStd":"APQP / PPAP Level 3","record":"首批量产质量回顾报告"},
          {"id":"rd-7-6","item":"PPAP生产件批准","content":"按PPAP Level 3要求提交全套文件给客户批准","standard":"客户PPAP签署批准","type":"关键","tool":"PPAP文档包(18项)","refStd":"AIAG PPAP 第4版","record":"PPAP批准文件"}
        ],
        "risks":[
          {"level":"high","text":"变更管理失控→严格执行ECO/ECR流程+变更委员会"},
          {"level":"medium","text":"量产质量波动→SPC过程控制+快速响应机制"}
        ],
        "collab":[
          {"item":"PPAP提交客户", "owner":"项目经理", "deadline":"量产前", "status":"pending"},
          {"item":"正式BOM成本锁定", "owner":"财务", "deadline":"量产前", "status":"pending"},
          {"item":"产能释放通知", "owner":"生产计划", "deadline":"量产前", "status":"pending"},
          {"item":"售后培训材料移交", "owner":"服务部", "deadline":"量产前", "status":"pending"}
        ]
      },
      // ===== RD Phase 8: 售后反馈闭环 =====
      {"id":"rd-8","sortOrder":8,"name":"1.8 售后反馈闭环","standardHours":"持续进行","canParallel":true,"witness":"客服总监/质量总监",
        "checks":[
          {"id":"rd-8-1","item":"历史项目问题清单梳理","content":"收集过去12个月所有现场问题(客诉/8D/退货)，分类统计TOP问题","standard":"覆盖100%已交付项目","type":"关键","tool":"CRM/售后管理系统","refStd":"GB/T 19001-2018","record":"历史问题统计分析报告"},
          {"id":"rd-8-2","item":"根因分析(RCA)与改进措施","content":"对TOP5问题用5Why/鱼骨图/FTA进行根因分析，制定纠正预防措施(CAPA)","standard":"CAPA有效率≥90%(6个月内不复发)","type":"关键","tool":"8D报告/5Why/鱼骨图","refStd":"IATF 16949:2016 / 8D方法","record":"根因分析报告+CAPA跟踪表"},
          {"id":"rd-8-3","item":"新品设计优化确认","content":"将历史问题的改进措施落实到新产品设计中(设计变更/规范更新)","standard":"TOP问题改进措施100%落地到新品","type":"关键","tool":"PLM/ECR系统","refStd":"GB/T 19001-2016 / IATF 16949","record":"设计优化落实清单"},
          {"id":"rd-8-4","item":"售后服务手册(SM)编制发布","content":"安装/调试/运维/故障排查/备件更换/应急处理全套服务文档","standard":"SM覆盖100%运维场景","type":"重要","tool":"文档编写工具/DMS","refStd":"GB/T 19001-2016","record":"售后服务手册(SM)"},
          {"id":"rd-8-5","item":"备品备件清单(BOM-S)发布","content":"根据MTBF分析和现场故障数据，制定推荐备件清单和安全库存量","standard":"备件覆盖率≥98%(按故障率加权)","type":"重要","tool":"备件分析模型/ERP","refStd":"GB/T 13384-2008","record":"备品备件清单(BOM-S)"},
          {"id":"rd-8-6","item":"客户培训与知识转移","content":"对客户运维团队进行产品原理/操作/维护/安全培训并通过考核","standard":"参训人员考核通过率100%","type":"重要","tool":"培训课件/考核试卷","refStd":"ISO 10015:2019","record":"培训记录+考核成绩单"},
          {"id":"rd-8-7","item":"持续改进机制建立","content":"建立定期(月度/季度)售后质量回顾(VOC→CTQ)机制","standard":"VOC回顾会常态化召开","type":"一般","tool":"质量例会模板","refStd":"GB/T 19001-2016 / PDCA","record":"持续改进会议纪要"}
        ],
        "risks":[
          {"level":"high","text":"历史问题未闭环→强制性问题升级机制+管理层Review"},
          {"level":"medium","text":"同类问题复发→CAPA有效性验证+防错设计"}
        ],
        "collab":[
          {"item":"历史8D报告归档", "owner":"质量部", "deadline":"设计输入前", "status":"pending"},
          {"item":"新品改进措施验证", "owner":"研发部", "deadline":"设计冻结前", "status":"pending"},
          {"item":"备件库存建账", "owner":"供应链", "deadline":"量产前", "status":"pending"},
          {"item":"客户培训计划", "owner":"客服部", "deadline":"交付前", "status":"pending"}
        ]
      }
    ]
  };

  // ========== 初始化（同步优先，异步增强）==========

  async function init() {
    console.log('Store.init() 开始...');

    // ① 同步构建初始状态（确保立即可用）
    _state = buildSyncState();
    _initResolved = true;
    console.log('Store: 同步初始化完成, 项目数:', _state.projects.length);

    // ② 异步后台增强（非阻塞）
    enrichIfPossible().catch(e => {
      console.log('Store: 后台增强跳过（file://协议或网络不可用）');
    });

    return _state;
  }

  function buildSyncState() {
    // 优先从LocalStorage恢复（需版本匹配）
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed._version === STORAGE_VERSION && parsed.projects && Array.isArray(parsed.projects) && parsed.projects.length > 0) {
          console.log('Store: 从LocalStorage恢复 v' + STORAGE_VERSION, parsed.projects.length, '个项目');
          // ★ SOP结构迁移检查（即使版本匹配也要确保phases字段存在）
          if (!parsed.installSOP || !parsed.installSOP.phases) parsed.installSOP = EMBEDDED_INSTALL_SOP;
          if (!parsed.satSOP || !parsed.satSOP.phases || parsed.satSOP.phases.length !== EMBEDDED_SAT_SOP.phases.length) parsed.satSOP = EMBEDDED_SAT_SOP;
          if (!parsed.fatSOP || !parsed.fatSOP.phases || !parsed.fatSOP.phases.length) parsed.fatSOP = EMBEDDED_FAT_SOP;
          // ★ RD SOP 迁移：阶段数不匹配时用内联数据重建（保留已有勾选状态）
          var _embRdPhases = EMBEDDED_RD_SOP.phases || [];
          if (!parsed.rdSOP || !parsed.rdSOP.phases || !parsed.rdSOP.phases.length || parsed.rdSOP.phases.length !== _embRdPhases.length) {
            var _oldCheckStates = {};
            if (parsed.rdSOP && parsed.rdSOP.phases) {
              parsed.rdSOP.phases.forEach(function(op){ (op.checks||[]).forEach(function(oc){ _oldCheckStates[oc.id] = !!oc.done; }); });
            }
            parsed.rdSOP = JSON.parse(JSON.stringify(EMBEDDED_RD_SOP));
            parsed.rdSOP.phases.forEach(function(np){ (np.checks||[]).forEach(function(nc){ if (_oldCheckStates[nc.id]) nc.done = true; }); });
          }
          // ★ refStd字段迁移 + 名称同步：旧数据checks可能缺少refStd，阶段名可能过时
          if (parsed.fatSOP && parsed.fatSOP.phases) {
            var _embPhases = EMBEDDED_FAT_SOP.phases || [];
            var _embMap = {};
            _embPhases.forEach(function(ep){ _embMap[ep.id] = ep; });
            parsed.fatSOP.phases.forEach(function(pp){
              var _embP = _embMap[pp.id];
              if (_embP) {
                // 同步最新名称
                if (_embP.name && pp.name !== _embP.name) pp.name = _embP.name;
                // 同步refStd
                if (_embP.checks) {
                  var _embCheckMap = {};
                  _embP.checks.forEach(function(ec){ _embCheckMap[ec.id] = ec; });
                  (pp.checks||[]).forEach(function(pc){
                    if (!pc.refStd && _embCheckMap[pc.id] && _embCheckMap[pc.id].refStd) {
                      pc.refStd = _embCheckMap[pc.id].refStd;
                    }
                  });
                }
              }
            });
          }
          return parsed;
        }
        console.log('Store: LocalStorage版本不匹配或数据无效, 使用内联数据 (v' + STORAGE_VERSION + ')');
      }
    } catch (e) {
      console.warn('Store: LocalStorage读取失败, 使用内联数据');
    }

    // 使用内联嵌入式数据
    console.log('Store: 使用内联嵌入式数据 v' + STORAGE_VERSION);
    var fresh = {
      _version: STORAGE_VERSION,
      selectedProjectId: DEFAULT_PROJECT_ID,
      projects: JSON.parse(JSON.stringify(EMBEDDED_PROJECTS)),
      installSOP: EMBEDDED_INSTALL_SOP,
      satSOP: EMBEDDED_SAT_SOP,
      fatSOP: EMBEDDED_FAT_SOP,
      rdSOP: EMBEDDED_RD_SOP
    };
    return fresh;
  }

  async function enrichIfPossible() {
    // 尝试从远程加载更新的数据（仅当网络可用时）
    try {
      const [prjResp, insResp, satResp, fatResp] = await Promise.allSettled([
        fetchWithTimeout('data/projects.json', 3000),
        fetchWithTimeout('data/install-sop.json', 3000),
        fetchWithTimeout('data/sat-sop.json', 3000),
        fetchWithTimeout('data/fat-sop.json', 3000)
      ]);

      // 项目数据
      if (prjResp.status === 'fulfilled' && prjResp.value) {
        const prj = prjResp.value;
        if (prj.projects && prj.projects.length > 0) {
          // 合并远程数据（保留本地SOP和用户操作状态）
          const localSOPs = { installSOP: _state.installSOP, satSOP: _state.satSOP, fatSOP: _state.fatSOP };
          _state.projects = prj.projects;
          _state.selectedProjectId = prj.defaultProjectId || DEFAULT_PROJECT_ID;
          _state.installSOP = localSOPs.installSOP;
          _state.satSOP = localSOPs.satSOP;
          _state.fatSOP = localSOPs.fatSOP;
          console.log('Store: 远程项目数据加载成功');
        }
      }

      // SOP数据（不覆盖已嵌入的数据）
      if (insResp.status === 'fulfilled' && insResp.value && insResp.value.phases) {
        _state.installSOP = insResp.value;
      }
      if (satResp.status === 'fulfilled' && satResp.value && satResp.value.phases) {
        _state.satSOP = satResp.value;
      }
      if (fatResp.status === 'fulfilled' && fatResp.value && fatResp.value.phases && fatResp.value.phases.length) {
        _state.fatSOP = fatResp.value;
      }
    } catch (e) {
      // 静默失败，已使用嵌入式数据
    }

    persist();
    notify('dataChanged', {});
  }

  function fetchWithTimeout(url, timeoutMs) {
    return new Promise(function(resolve, reject) {
      var controller = new AbortController();
      var timer = setTimeout(function() { controller.abort(); }, timeoutMs);
      fetch(url, { signal: controller.signal })
        .then(function(r) {
          clearTimeout(timer);
          if (!r.ok) { reject(new Error('HTTP ' + r.status)); return; }
          return r.json();
        })
        .then(function(data) {
          clearTimeout(timer);
          resolve(data);
        })
        .catch(function(e) {
          clearTimeout(timer);
          reject(e);
        });
    });
  }

  function isReady() { return _initResolved; }

  // ========== 持久化 ==========

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(_state));
    } catch (e) {
      console.warn('Store: LocalStorage写入失败', e);
    }
  }

  function notify(event, data) {
    _listeners.forEach(function(fn) { try { fn(event, data); } catch (e) {} });
  }

  // ========== 公开API ==========

  function getState() { return _state; }

  function getSelectedProjectId() { return _state ? _state.selectedProjectId : DEFAULT_PROJECT_ID; }

  function getSelectedProject() {
    if (!_state || !_state.projects) return EMBEDDED_PROJECTS[2];
    return _state.projects.find(function(p) { return p.id === _state.selectedProjectId; }) || _state.projects[0] || EMBEDDED_PROJECTS[2];
  }

  function getAllProjects() {
    if (!_state || !_state.projects) return EMBEDDED_PROJECTS;
    return _state.projects.length > 0 ? _state.projects : EMBEDDED_PROJECTS;
  }

  function setSelectedProject(projectId) {
    if (!_state) return;
    _state.selectedProjectId = projectId;
    persist();
    notify('projectChanged', { project: getSelectedProject() });
    notify('dataChanged', {});
  }

  function getProjectPhases(projectId) {
    var pid = projectId || (_state && _state.selectedProjectId);
    var pj = _state && _state.projects ? _state.projects.find(function(p) { return p.id === pid; }) : null;
    return pj ? pj.phases : {};
  }

  function setPhaseProgress(projectId, phaseKey, completed) {
    if (!_state) return;
    var pj = _state.projects.find(function(p) { return p.id === (projectId || _state.selectedProjectId); });
    if (!pj || !pj.phases[phaseKey]) return;
    pj.phases[phaseKey].completed = Math.max(0, Math.min(100, Number(completed) || 0));

    var phaseKeys = Object.keys(pj.phases).sort();
    var maxPhase = 1;
    for (var i = phaseKeys.length - 1; i >= 0; i--) {
      if (pj.phases[phaseKeys[i]].completed > 0) { maxPhase = i + 1; break; }
    }
    pj.currentPhase = maxPhase;

    persist();
    notify('progressChanged', { projectId: pj.id, phaseKey: phaseKey, completed: completed, currentPhase: maxPhase });
    notify('dataChanged', {});
  }

  // ========== SOP数据获取 ==========

  function getInstallSOP() { return (_state && _state.installSOP) || EMBEDDED_INSTALL_SOP; }
  function getSatSOP() { return (_state && _state.satSOP) || EMBEDDED_SAT_SOP; }
  function getFatSOP() { return (_state && _state.fatSOP) || EMBEDDED_FAT_SOP; }
  function getRdSOP() { return (_state && _state.rdSOP) || EMBEDDED_RD_SOP; }

  function getSOPCheckState(projectId, sopType, checkId) {
    if (!_state) return null;
    var pj = _state.projects.find(function(p) { return p.id === (projectId || _state.selectedProjectId); });
    if (!pj) return null;
    var key = 'sop_' + sopType;
    if (!pj[key]) pj[key] = {};
    return pj[key][checkId] || null;
  }

  function setSOPCheckState(projectId, sopType, checkId, passed, notes) {
    if (!_state) return;
    var pj = _state.projects.find(function(p) { return p.id === (projectId || _state.selectedProjectId); });
    if (!pj) return;
    var key = 'sop_' + sopType;
    if (!pj[key]) pj[key] = {};
    pj[key][checkId] = { passed: !!passed, notes: notes || '', updatedAt: new Date().toISOString() };
    persist();
    notify('sopChanged', { projectId: pj.id, sopType: sopType, checkId: checkId, passed: !!passed });
  }

  // ========== 导入/导出 ==========

  function exportFullJSON() { return JSON.stringify(_state, null, 2); }

  function importFullJSON(jsonStr) {
    try {
      var data = JSON.parse(jsonStr);
      if (!data.projects || !Array.isArray(data.projects)) throw new Error('无效数据格式');
      _state = data;
      if (!_state.selectedProjectId || !_state.projects.find(function(p) { return p.id === _state.selectedProjectId; })) {
        _state.selectedProjectId = _state.projects[0] ? _state.projects[0].id : DEFAULT_PROJECT_ID;
      }
      // 确保SOP数据存在
      if (!_state.installSOP || !_state.installSOP.phases) _state.installSOP = EMBEDDED_INSTALL_SOP;
      if (!_state.satSOP || !_state.satSOP.phases) _state.satSOP = EMBEDDED_SAT_SOP;
      if (!_state.fatSOP || !_state.fatSOP.phases || !_state.fatSOP.phases.length) _state.fatSOP = EMBEDDED_FAT_SOP;
      persist();
      notify('projectChanged', { project: getSelectedProject() });
      notify('dataChanged', {});
      return true;
    } catch (e) { console.error('Store: 导入失败', e); return false; }
  }

  function importProjectsFromCSV(csvText) {
    var lines = csvText.trim().split(/\r?\n/);
    if (lines.length < 2) return { success: false, message: 'CSV无数据行' };
    var headers = lines[0].split(',').map(function(h) { return h.trim(); });
    var imported = [];
    for (var i = 1; i < lines.length; i++) {
      var vals = lines[i].split(',').map(function(v) { return v.trim(); });
      if (vals.length < 6) continue;
      imported.push({
        id: String(Date.now()) + '-' + i, name: vals[0]||'', capacity: vals[1]||'',
        batteryTech: vals[2]||'LFP', cabinetCount: vals[3]||'', cabinetModel: vals[4]||'',
        location: vals[5]||'', contractType: vals[6]||'EPC', status: vals[7]||'计划交付',
        currentPhase: 1, phases: makeEmptyPhases()
      });
    }
    if (imported.length === 0) return { success: false, message: '未解析到有效项目数据' };
    _state.projects = (_state.projects || []).concat(imported);
    persist();
    notify('projectChanged', { project: getSelectedProject() });
    notify('dataChanged', {});
    return { success: true, message: '成功导入 ' + imported.length + ' 个项目', count: imported.length };
  }

  function addProject(projData) {
    var proj = {
      id: String(Date.now()), name: projData.name || '新项目',
      capacity: projData.capacity || '', batteryTech: projData.batteryTech || 'LFP',
      cabinetCount: projData.cabinetCount || '', cabinetModel: projData.cabinetModel || '',
      location: projData.location || '', contractType: projData.contractType || 'EPC',
      status: projData.status || '计划交付', currentPhase: 1, phases: makeEmptyPhases()
    };
    _state.projects.push(proj);
    persist();
    notify('projectChanged', { project: getSelectedProject() });
    return proj;
  }

  function resetProject(projectId) {
    if (!_state) return;
    var pj = _state.projects.find(function(p) { return p.id === (projectId || _state.selectedProjectId); });
    if (!pj) return;
    Object.keys(pj.phases).forEach(function(k) { pj.phases[k].completed = 0; pj.phases[k].notes = ''; });
    pj.currentPhase = 1;
    ['sop_install','sop_sat','sop_fat'].forEach(function(k) { delete pj[k]; });
    persist();
    notify('projectChanged', { project: pj });
    notify('dataChanged', {});
  }

  function makeEmptyPhases() {
    var ph = {};
    ['1_rnd','2_bd','3_mfg','4_logistics','5_install','6_commission','7_handover','8_aftersales','9_ops']
      .forEach(function(k) { ph[k] = { completed: 0, notes: '' }; });
    return ph;
  }

  function on(event, fn) { _listeners.push(fn); }
  function off(fn) { _listeners = _listeners.filter(function(f) { return f !== fn; }); }

  // 暴露API
  return {
    init: init, persist: persist, getState: getState,
    getSelectedProjectId: getSelectedProjectId,
    getSelectedProject: getSelectedProject,
    getAllProjects: getAllProjects,
    isReady: isReady,
    setSelectedProject: setSelectedProject,
    getProjectPhases: getProjectPhases,
    setPhaseProgress: setPhaseProgress,
    getInstallSOP: getInstallSOP,
    getSatSOP: getSatSOP,
    getFatSOP: getFatSOP,
    getRdSOP: getRdSOP,
    getSOPCheckState: getSOPCheckState,
    setSOPCheckState: setSOPCheckState,
    exportFullJSON: exportFullJSON,
    importFullJSON: importFullJSON,
    importProjectsFromCSV: importProjectsFromCSV,
    addProject: addProject,
    resetProject: resetProject,
    on: on, off: off
  };
})();
