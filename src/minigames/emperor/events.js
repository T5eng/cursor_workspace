// 嘉靖朝随机事件库

import { rollCheck, applyEffects } from './engine.js';

function eligible(event, state) {
  const c = event.when || {};
  if (c.minYear != null && state.year < c.minYear) return false;
  if (c.maxYear != null && state.year > c.maxYear) return false;
  if (c.flag && !state.flags[c.flag]) return false;
  if (c.notFlag && state.flags[c.notFlag]) return false;
  if (c.minStat) {
    for (const [k, v] of Object.entries(c.minStat)) {
      if (state.stats[k] < v) return false;
    }
  }
  if (c.maxStat) {
    for (const [k, v] of Object.entries(c.maxStat)) {
      if (state.stats[k] > v) return false;
    }
  }
  return true;
}

export function pickEvent(state) {
  const recent = new Set(state.lastEventIds);
  let pool = EVENTS.filter(e => eligible(e, state) && !recent.has(e.id));
  if (pool.length === 0) {
    pool = EVENTS.filter(e => eligible(e, state));
  }
  const total = pool.reduce((s, e) => s + (e.weight || 8), 0);
  let r = Math.random() * total;
  for (const e of pool) {
    r -= e.weight || 8;
    if (r <= 0) return e;
  }
  return pool[pool.length - 1];
}

export function resolveChoice(state, event, choiceIndex) {
  const choice = event.choices[choiceIndex];
  if (!choice) return { state, narrative: '无效抉择。' };

  let narrative = choice.result || '';
  let effects = { ...(choice.effects || {}) };
  let roll = null;

  if (choice.check) {
    const statVal = state.stats[choice.check.stat];
    roll = rollCheck(statVal, choice.check.dc);
    const branch = roll.success ? choice.onSuccess : choice.onFail;
    if (branch?.effects) effects = { ...effects, ...branch.effects };
    if (branch?.result) narrative = branch.result;
    if (branch?.flag) effects._flag = branch.flag;
  }

  if (choice.flag) effects._flag = choice.flag;
  if (choice.clearFlag) effects._clearFlag = choice.clearFlag;

  const flag = effects._flag;
  const clearFlag = effects._clearFlag;
  delete effects._flag;
  delete effects._clearFlag;

  const stats = applyEffects(state.stats, effects);
  const flags = { ...state.flags };
  if (flag) flags[flag] = true;
  if (clearFlag) delete flags[clearFlag];

  let next = {
    ...state,
    stats,
    flags,
    lastRoll: roll,
    pendingOutcome: narrative
  };

  if (choice.log) next = { ...next, log: [choice.log, ...next.log].slice(0, 24) };

  return { state: next, narrative, roll };
}

export const INTRO = {
  title: '嘉靖朝·天子跑团',
  era: '大明嘉靖二十一年（1542）',
  paragraphs: [
    '你即帝位已二十一年。少年时曾「嘉靖之治」，如今却深居西苑，炼丹修道，将朝政托付权臣。',
    '严嵩父子把持内阁，清流士大夫暗中结党；东南倭寇未平，北方鞑靼时犯边关。连年旱涝，流民啸聚，天象异兆屡见史书。',
    '本跑团以**季节回合**推进：每季随机遭遇宫斗、权斗、战争、天灾或玄学事件。你的抉择将牵动六维国运——',
    '**龙体、威信、国库、军威、民心、猜忌**。任何一项失衡，都可能导致驾崩、遇刺、政变或亡国。',
    `目标：在波谲云诡的朝局中再活 **${12} 年**（48 季），方可称「中兴之世」。祝陛下圣安——若还能撑到那时。`
  ]
};

export const EVENTS = [
  // —— 宫斗 ——
  {
    id: 'tea_poison',
    category: 'palace',
    weight: 12,
    title: '坤宁宫赐茶',
    text: '方皇后病愈后亲至西苑献茶，说是「替陛下清心」。内侍低声提醒：坤宁宫近日与严府走动甚密。',
    choices: [
      {
        label: '欣然饮下，示以信任',
        effects: { suspicion: -6, prestige: 4, health: -8 },
        result: '茶中似有异物，你强撑体面饮尽，夜半腹痛。太医不敢声张。'
      },
      {
        label: '命人先试，再决定是否饮',
        check: { stat: 'prestige', dc: 55 },
        onSuccess: { effects: { suspicion: 8, prestige: 6 }, result: '试茶太监暴毙。你冷面掷杯：「皇后好意，朕心领了。」' },
        onFail: { effects: { suspicion: 12, morale: -6 }, result: '试茶之事泄露，后宫怨声载道，说你「疑妻如疑贼」。' }
      },
      {
        label: '称病推脱，改日再叙',
        effects: { suspicion: 4, prestige: -3 },
        result: '方皇后拂袖而去。宫中传言：陛下连茶都不敢喝。'
      }
    ]
  },
  {
    id: 'heir_dispute',
    category: 'palace',
    weight: 11,
    title: '储君之争',
    text: '太子朱载堃与景王朱载圳各有党羽。奏折堆满案头，或请立嫡，或请「择贤」。',
    choices: [
      {
        label: '公开力挺太子，压制景王',
        effects: { prestige: 8, suspicion: 10, morale: 3 },
        result: '景王党羽蛰伏，太子一党气焰更盛——你似乎多了一把刀。'
      },
      {
        label: '拖延不议，令两王各自上表自辩',
        check: { stat: 'treasury', dc: 50 },
        onSuccess: { effects: { prestige: 5, treasury: -5 }, result: '两党互相攻讦，你坐观虎斗，暂保平衡。' },
        onFail: { effects: { suspicion: 8, military: -5 }, result: '两派在朝堂大打出手，一名御史血溅丹陛。' }
      },
      {
        label: '召母子入宫，家宴调和',
        effects: { morale: 6, health: -4, suspicion: -4 },
        result: '家宴上和气，回宫后却各自扩充人手。'
      }
    ]
  },
  {
    id: 'maid_intrigue',
    category: 'palace',
    weight: 10,
    title: '宫女告密',
    text: '一名贴身宫女跪地，呈上密信：某答应与严世蕃暗通款曲，欲在宫中培植眼线。',
    choices: [
      {
        label: '立刻拿人，交东厂审讯',
        effects: { suspicion: 12, prestige: 6, morale: -4 },
        flag: 'dongchang_active',
        result: '东厂连夜抄宫，三人屈打成招。后宫人人自危。'
      },
      {
        label: '暗中监视，欲擒故纵',
        check: { stat: 'suspicion', dc: 58 },
        onSuccess: { effects: { suspicion: -8, prestige: 8 }, result: '你顺藤摸瓜，截获严党与宫闱联络网。' },
        onFail: { effects: { health: -12, suspicion: 6 }, result: '反被将计就计，你的寝殿钥匙被人拓印。' }
      },
      {
        label: '焚信装作不知',
        effects: { suspicion: -5, prestige: -8, health: 3 },
        result: '宫女失望退下。数月后，另一封密信出现在枕下。'
      }
    ]
  },
  {
    id: 'consort_dance',
    category: 'palace',
    weight: 9,
    title: '昭仪献舞',
    text: '阎昭仪在西苑献《霓裳》，舞姿极美。严嵩奏称：昭仪父与倭寇有走私之嫌，舞是「媚君乱政」。',
    choices: [
      {
        label: '赏金帛，留其伴驾',
        effects: { health: 5, prestige: -6, suspicion: 6 },
        result: '你暂得欢愉，清流奏章雪片般飞来。'
      },
      {
        label: '逐出西苑，交刑部查父',
        effects: { prestige: 7, morale: -3, suspicion: 4 },
        result: '昭仪哭离。刑部查无实据，严嵩却说你「明察」。'
      },
      {
        label: '令其与严世蕃对质',
        check: { stat: 'prestige', dc: 62 },
        onSuccess: { effects: { prestige: 10, suspicion: -5 }, result: '对质会上严党失态，昭仪父冤情大白。' },
        onFail: { effects: { suspicion: 10, treasury: -8 }, result: '对质变成闹剧，你被视为「戏君」。' }
      }
    ]
  },

  // —— 权斗 ——
  {
    id: 'yansong_bribe',
    category: 'power',
    weight: 14,
    title: '严嵩献瑞',
    text: '严嵩呈「千年灵芝」与漕运利账，请封其子世蕃为工部侍郎。徐阶一派跪谏不可。',
    choices: [
      {
        label: '准奏，换严家出力修殿',
        effects: { treasury: 12, prestige: -10, suspicion: 8, morale: -6 },
        flag: 'yansong_strong',
        result: '严党声势更炽，徐阶等人俯首不语，眼中却有寒光。'
      },
      {
        label: '驳回，升徐阶为户部右侍郎',
        effects: { prestige: 8, treasury: -10, suspicion: 12 },
        flag: 'qingliu_up',
        result: '严嵩老泪纵横（假的）。陛下，您这步棋走得险。'
      },
      {
        label: '准工部，但派太监监修',
        check: { stat: 'treasury', dc: 52 },
        onSuccess: { effects: { treasury: 5, prestige: 3, suspicion: 2 }, result: '两边都不得罪彻底，却也都没完全满意。' },
        onFail: { effects: { treasury: -12, suspicion: 6 }, result: '监修太监被严党买通，内帑又亏一笔。' }
      }
    ]
  },
  {
    id: 'memorial_flood',
    category: 'power',
    weight: 11,
    title: '奏折如山',
    text: '一日之间三百余本奏折：有弹劾严嵩，有弹劾徐阶，有请赈灾，有请修仙。你头痛欲裂。',
    choices: [
      {
        label: '悉数留中不发',
        effects: { prestige: -8, morale: -5, health: 4 },
        result: '朝野猜测：陛下到底在看什么？'
      },
      {
        label: '只批赈灾与边防',
        effects: { treasury: -10, military: 8, morale: 8, prestige: 4 },
        result: '灾民稍安，武将称颂。党争奏折继续堆积。'
      },
      {
        label: '召内阁封驳，限一日清完',
        check: { stat: 'prestige', dc: 60 },
        onSuccess: { effects: { prestige: 9, suspicion: 5 }, result: '内阁连夜加班，竟真清出一批贪腐案。' },
        onFail: { effects: { prestige: -6, suspicion: 8, health: -6 }, result: '封驳出错，错把忠臣当奸党下狱。' }
      }
    ]
  },
  {
    id: 'eunuch_power',
    category: 'power',
    weight: 10,
    title: '太监掌印',
    text: '司礼监掌印太监请兼东厂提督，称「方便为陛下分忧」。清流斥为「阉竖乱政」。',
    choices: [
      {
        label: '准',
        effects: { suspicion: 15, prestige: -5, military: 5 },
        flag: 'dongchang_active',
        result: '厂卫横行，连严嵩都要让他们三分。'
      },
      {
        label: '不准，赏黄金令其养老',
        effects: { treasury: -8, prestige: 6, suspicion: -4 },
        result: '老太监含笑退下，新人却更难捉摸。'
      },
      {
        label: '准东厂，不准兼盐运',
        check: { stat: 'suspicion', dc: 55 },
        onSuccess: { effects: { suspicion: 6, treasury: 4 }, result: '权力有边界，厂卫与严党互咬，你居中调停。' },
        onFail: { effects: { suspicion: 12, health: -8 }, result: '太监表面谢恩，背地串联妃嫔监视你。' }
      }
    ]
  },
  {
    id: 'imperial_exam',
    category: 'power',
    weight: 9,
    title: '春闱舞弊',
    text: '会试传出泄题，举子聚众闹事。严党举子涉案，徐阶门生亦被牵连。',
    choices: [
      {
        label: '罢黜主考，明年重考',
        effects: { prestige: 6, morale: 5, treasury: -6 },
        result: '士林称颂圣明，也有人骂你「耽误读书人前程」。'
      },
      {
        label: '压下事态，维持原榜',
        effects: { prestige: -12, morale: -10, treasury: 8 },
        result: '新科进士多是权贵子弟，朝堂正气再损。'
      },
      {
        label: '亲自策问前三名',
        check: { stat: 'prestige', dc: 65 },
        onSuccess: { effects: { prestige: 12, morale: 8, health: -5 }, result: '你殿试出题，真才脱颖而出，传为佳话。' },
        onFail: { effects: { prestige: -8, health: -10 }, result: '策问途中你咳血，举子窃议「天命已去」。' }
      }
    ]
  },

  // —— 战争 ——
  {
    id: 'wokou_raid',
    category: 'war',
    weight: 13,
    title: '倭寇犯浙',
    text: '倭寇攻陷台州沿海，戚继光请饷练兵。严嵩称「小题大做」，户部称无钱。',
    choices: [
      {
        label: '拨内帑二十万两，支持戚家军',
        effects: { treasury: -18, military: 14, morale: 8, prestige: 6 },
        flag: 'qijia_army',
        result: '戚继光大破倭寇，捷报传至西苑，你难得睡了个好觉。'
      },
      {
        label: '令严嵩督办，限期平倭',
        check: { stat: 'treasury', dc: 48 },
        onSuccess: { effects: { military: 8, treasury: -6, suspicion: 5 }, result: '严党克扣军饷，但戚继光仍胜。严嵩表功，你心知肚明。' },
        onFail: { effects: { military: -15, morale: -10, prestige: -8 }, result: '台州失守，百姓被掳，血书呈到御前。' }
      },
      {
        label: '招安倭首，许贸易',
        effects: { treasury: 6, military: -8, prestige: -10, morale: -8 },
        result: '倭患暂歇，清流骂你「卖国」。次年倭寇再来，声势更盛。'
      }
    ]
  },
  {
    id: 'mongol_border',
    category: 'war',
    weight: 11,
    title: '鞑靼犯宣府',
    text: '俺答汗率军十万犯宣府，边关烽火昼夜不息。守将请援，内阁争论主和主战。',
    choices: [
      {
        label: '御驾亲征（至居庸关）',
        effects: { military: 10, health: -15, prestige: 12, treasury: -12 },
        result: '你未至前线，但御驾在关，士气大振，鞑靼退走。你染风寒。'
      },
      {
        label: '命仇鸾率军迎敌',
        check: { stat: 'military', dc: 58 },
        onSuccess: { effects: { military: 6, prestige: 4, treasury: -8 }, result: '仇鸾虚报战功，至少边关保住了。' },
        onFail: { effects: { military: -18, morale: -12 }, result: '大军溃败，鞑靼掠去人畜无数。' }
      },
      {
        label: '开市互市，暂许通贡',
        effects: { treasury: 10, military: -6, prestige: -6, morale: -4 },
        result: '边境稍安，武将认为你「怯战」。'
      }
    ]
  },
  {
    id: 'mutiny_soldiers',
    category: 'war',
    weight: 10,
    when: { minYear: 23 },
    title: '兵变',
    text: '宣府欠饷三月，士卒缚杀巡抚，拥立头目，要求「清君侧、诛奸臣」。',
    choices: [
      {
        label: '诛杀欠饷贪官，补发军饷',
        effects: { treasury: -20, military: 10, morale: 6, prestige: 5 },
        result: '兵变平息，你将责任推给地方，严嵩却暗暗记恨。'
      },
      {
        label: '派厂卫暗杀兵首',
        effects: { suspicion: 10, military: 4, morale: -8 },
        result: '兵首暴毙，士卒更怒，边关暗流涌动。'
      },
      {
        label: '下罪己诏，裁撤宫中用度',
        effects: { prestige: 8, morale: 10, treasury: 8, health: -5 },
        result: '士卒落泪，京城百姓称你是「苦皇帝」。'
      }
    ]
  },
  {
    id: 'navy_budget',
    category: 'war',
    weight: 8,
    title: '水师废置',
    text: '工部奏：福船水师年耗巨万，请裁撤一半，改修西苑池塘。',
    choices: [
      {
        label: '保留水师',
        effects: { treasury: -12, military: 10, prestige: 3 },
        result: '东南海防稍固，内廷却怨你「不爱享乐」。'
      },
      {
        label: '裁撤一半',
        effects: { treasury: 8, military: -10, health: 5 },
        result: '池塘映月，你炼丹更静。倭寇探子喜笑颜开。'
      },
      {
        label: '改商船为战船，招商补饷',
        check: { stat: 'treasury', dc: 55 },
        onSuccess: { effects: { treasury: 5, military: 6, morale: 3 }, result: '新法试行，海商抱怨，倭患略减。' },
        onFail: { effects: { treasury: -8, military: -5 }, result: '招商使卷款潜逃，朝野哗然。' }
      }
    ]
  },

  // —— 天灾 ——
  {
    id: 'drought_north',
    category: 'disaster',
    weight: 14,
    title: '北地大旱',
    text: '河南、山西赤地千里，人相食。户部请开仓赈济，严嵩请「加派丝税」补亏空。',
    choices: [
      {
        label: '开仓赈济，停修宫殿',
        effects: { treasury: -16, morale: 14, prestige: 8, health: -3 },
        result: '灾民得活，你听到「陛下万岁」时，眼角有些湿。'
      },
      {
        label: '加派丝税',
        effects: { treasury: 14, morale: -18, prestige: -10, suspicion: 6 },
        result: '税吏下乡，暴民斩旗。'
      },
      {
        label: '令富户捐粮，封官激励',
        check: { stat: 'prestige', dc: 54 },
        onSuccess: { effects: { treasury: -4, morale: 10, prestige: 6 }, result: '富户捐粮，你赐「义绅」匾额，灾情稍解。' },
        onFail: { effects: { morale: -12, suspicion: 8 }, result: '富户勾结官吏，假捐真囤，民变四起。' }
      }
    ]
  },
  {
    id: 'yellow_river',
    category: 'disaster',
    weight: 12,
    title: '黄河决口',
    text: '黄河在徐州决口，淹没三府。河工请银百万两，内阁争吵是否改道。',
    choices: [
      {
        label: '拨银堵口，征发民夫',
        effects: { treasury: -22, morale: 12, prestige: 5, health: -4 },
        result: '堵口三月方成，你瘦了一圈，百姓称「真龙治水」。'
      },
      {
        label: '听天由命，迁民而已',
        effects: { treasury: -4, morale: -16, prestige: -12 },
        result: '难民拥向京师，瘟疫阴影逼近。'
      },
      {
        label: '令严嵩总督河工',
        check: { stat: 'treasury', dc: 50 },
        onSuccess: { effects: { treasury: -10, suspicion: 6, morale: 6 }, result: '严嵩贪了一笔，河却堵上了——史书如何写？' },
        onFail: { effects: { treasury: -15, morale: -14, military: -5 }, result: '河工溃败，严嵩称「天意」，你背锅。' }
      }
    ]
  },
  {
    id: 'plague_beijing',
    category: 'disaster',
    weight: 10,
    when: { maxStat: { morale: 40 } },
    title: '京城瘟疫',
    text: '永定门外死人无算，太医署请封城。严嵩请陛下移驾西苑「避瘟」。',
    choices: [
      {
        label: '封城，设坊隔离',
        effects: { morale: 8, prestige: 6, health: -8, treasury: -8 },
        result: '疫情稍控，你困在西苑，听闻哭声越墙。'
      },
      {
        label: '只移驾，不封城',
        effects: { health: 6, morale: -14, prestige: -8 },
        result: '你安全了，京城变成地狱。史笔如刀。'
      },
      {
        label: '亲祭天地，大赦天下',
        effects: { prestige: 10, morale: 10, treasury: -6, health: -10 },
        result: '百姓称颂，瘟疫仍蔓延，你病倒在榻。'
      }
    ]
  },
  {
    id: 'locusts',
    category: 'disaster',
    weight: 9,
    title: '飞蝗蔽日',
    text: '直隶蝗虫如云，禾苗尽食。地方奏请捕蝗，户部称无银。',
    choices: [
      {
        label: '拨银购鸭，全民捕蝗',
        effects: { treasury: -10, morale: 9, military: -2 },
        result: '鸭阵啄蝗，孩童奔走。你难得露出笑容。'
      },
      {
        label: '设坛驱蝗，道士作法',
        effects: { prestige: -6, morale: -4, health: -5, suspicion: 4 },
        result: '蝗虫未走，道士请赏。清流奏「妖道乱政」。'
      },
      {
        label: '免灾区三年赋税',
        effects: { treasury: -14, morale: 12, prestige: 7 },
        result: '百姓感恩，户部尚书写血书谏「国用不足」。'
      }
    ]
  },

  // —— 玄学 ——
  {
    id: 'comet_omen',
    category: 'mystic',
    weight: 12,
    title: '彗星守心',
    text: '钦天监奏：彗星犯心宿，主兵丧、宫变。道士陶仲文请筑斋醮台，炼「太平丹」。',
    choices: [
      {
        label: '大兴斋醮，亲撰青词',
        effects: { health: -8, prestige: -4, morale: 3, treasury: -10, suspicion: -5 },
        flag: 'alchemy_deep',
        result: '青词华美，道士称「圣化通神」。你夜不能寐，疑心病更重。'
      },
      {
        label: '斥为妄言，斩奏者',
        effects: { prestige: 5, morale: -6, suspicion: 8 },
        result: '钦天监闭嘴，天象仍在。三个月后，边关告急。'
      },
      {
        label: '斋醮三日，余者罢',
        check: { stat: 'health', dc: 52 },
        onSuccess: { effects: { health: 4, prestige: 2, treasury: -4 }, result: '你适可而止，史书记「帝心未昏」。' },
        onFail: { effects: { health: -12, suspicion: 6 }, result: '斋醮中你昏厥，道士献「仙丹」，实为铅汞。' }
      }
    ]
  },
  {
    id: 'elixir_poison',
    category: 'mystic',
    weight: 11,
    when: { flag: 'alchemy_deep' },
    title: '金丹大成？',
    text: '陶仲文献新丹，色如金，气如兰。近侍试丹无恙。你喉间发痒，却见仲文眼神闪烁。',
    choices: [
      {
        label: '吞服',
        effects: { health: -20, prestige: -5, suspicion: 5 },
        result: '丹入腹中如火，你吐出血丝，仲文已逃。'
      },
      {
        label: '令试丹者再服三日',
        effects: { health: -4, suspicion: 6 },
        result: '试丹太监暴毙。你免死一回，猜忌更深。'
      },
      {
        label: '赐丹给严嵩，观其反应',
        check: { stat: 'prestige', dc: 58 },
        onSuccess: { effects: { health: 3, prestige: 8, suspicion: -4 }, result: '严嵩称谢却未敢服。你笑：「奸与仙，皆虚妄。」' },
        onFail: { effects: { suspicion: 14, prestige: -8 }, result: '严嵩佯服，次日奏你「试毒害人」。' }
      }
    ]
  },
  {
    id: 'dream_ancestor',
    category: 'mystic',
    weight: 10,
    title: '太祖托梦',
    text: '你梦见太祖朱元璋持杖追打：「不务正业，权臣盈朝！」惊醒，枕巾尽汗。',
    choices: [
      {
        label: '次日早朝，亲理政务三日',
        effects: { prestige: 10, health: -8, suspicion: 6, treasury: -4 },
        result: '群臣震惊，严嵩称病。三日之后，你又回到西苑。'
      },
      {
        label: '召道士解梦',
        effects: { health: -4, prestige: -6, treasury: -6, suspicion: -3 },
        result: '道士说「太祖嫌陛下修殿不够」。你苦笑。'
      },
      {
        label: '默祷，不改常态',
        effects: { suspicion: 4, health: 3 },
        result: '梦渐忘，祸渐近。'
      }
    ]
  },
  {
    id: 'white_lotus',
    category: 'mystic',
    weight: 9,
    title: '白莲妖谶',
    text: '捕快擒获白莲教徒，搜出谶书：「嘉靖嘉靖，家家净也」。刑部请族诛。',
    choices: [
      {
        label: '族诛，天下禁教',
        effects: { morale: -8, suspicion: 10, prestige: 4, military: 3 },
        result: '血雨腥风，民间秘密更盛。'
      },
      {
        label: '只诛首恶，余者流放',
        effects: { morale: 4, prestige: 5, suspicion: 4 },
        result: '百姓称你有仁心，厂卫称你「软弱」。'
      },
      {
        label: '利用谶书，反制政敌',
        check: { stat: 'suspicion', dc: 62 },
        onSuccess: { effects: { prestige: 8, suspicion: -6 }, result: '你将谶书栽给政敌，朝局再洗牌。' },
        onFail: { effects: { suspicion: 12, morale: -10 }, result: '阴谋败露，白莲与清流同时骂你。' }
      }
    ]
  },
  {
    id: 'thunder_palace',
    category: 'mystic',
    weight: 8,
    title: '雷劈斋宫',
    text: '西苑斋宫被雷劈中，太监死二人。钦天监称「上天示警」，请停炼丹。',
    choices: [
      {
        label: '停丹半月，整顿斋宫',
        effects: { health: 8, prestige: 6, treasury: -5 },
        clearFlag: 'alchemy_deep',
        result: '你感到神清气爽，道士却窃议「道心不稳」。'
      },
      {
        label: '认为是「雷部斩妖」，继续炼丹',
        effects: { health: -10, prestige: -8, suspicion: 5 },
        flag: 'alchemy_deep',
        result: '铅汞再入腹，你视死如归。'
      },
      {
        label: '迁斋宫至紫禁城乾清宫侧',
        effects: { treasury: -12, suspicion: 8, prestige: 3 },
        result: '群臣反对「修道扰祖」，你执意为之。'
      }
    ]
  },

  // —— 综合 / 连锁 ——
  {
    id: 'assassin_attempt',
    category: 'palace',
    weight: 8,
    when: { minStat: { suspicion: 55 } },
    title: '夜半刀光',
    text: '蒙面人潜入西苑，刀锋离你咽喉三寸。侍卫长鸣钟，火把齐亮。',
    choices: [
      {
        label: '亲手斩杀，示众',
        effects: { prestige: 6, suspicion: 8, health: -6 },
        result: '你手抖却刺中，血溅龙袍。此后每夜难眠。'
      },
      {
        label: '留活口，东厂审讯',
        check: { stat: 'suspicion', dc: 56 },
        onSuccess: { effects: { suspicion: -10, prestige: 5 }, result: '供出太子党羽一名，朝局再震。' },
        onFail: { effects: { health: -18, suspicion: 6 }, result: '刺客咬毒自尽，线索断绝，你疑尽天下人。' }
      },
      {
        label: '隐瞒，称「有疯汉」',
        effects: { suspicion: 6, prestige: -5, health: -4 },
        result: '宫墙之内，人人皆知陛下险些丧命。'
      }
    ]
  },
  {
    id: 'famine_rebellion',
    category: 'disaster',
    weight: 10,
    when: { maxStat: { morale: 30, treasury: 25 } },
    title: '流民叩阙',
    text: '数万流民围正阳门，呼「开仓！诛奸！」。锦衣卫请驱散，徐阶请赈济。',
    choices: [
      {
        label: '开仓赈济，逮捕严世蕃顶罪',
        effects: { treasury: -18, morale: 12, prestige: 5, suspicion: 10 },
        result: '流民散去，严党恨你入骨。'
      },
      {
        label: '武力驱散',
        effects: { morale: -20, prestige: -10, military: 5, suspicion: 8 },
        result: '血染长街，史称「嘉靖屠民」。'
      },
      {
        label: '你现身城楼，痛哭罪己',
        check: { stat: 'prestige', dc: 64 },
        onSuccess: { effects: { morale: 16, prestige: 10, health: -8 }, result: '流民跪拜，危机化解，你成为「苦皇帝」传说。' },
        onFail: { effects: { health: -25, morale: -8 }, result: '乱箭射向城楼，你仓皇退入，威信尽失。' }
      }
    ]
  },
  {
    id: 'tianchang_strike',
    category: 'power',
    weight: 7,
    when: { flag: 'qingliu_up' },
    title: '言官死谏',
    text: '海瑞上《治安疏》，骂你「嘉靖嘉靖，家家净也」。奏疏传遍京师。',
    choices: [
      {
        label: '下狱，永不录用',
        effects: { prestige: -8, morale: -10, suspicion: 6 },
        result: '海瑞入狱，天下士子缄口。你心里却知道他骂得对。'
      },
      {
        label: '升其官，示胸怀',
        effects: { prestige: 12, morale: 8, suspicion: 12, treasury: -4 },
        result: '海瑞谢恩，严党惊恐。你赢得名声，也赢得更多暗箭。'
      },
      {
        label: '不见，留中',
        effects: { prestige: -4, suspicion: 4 },
        result: '疏文成为地下读物，你的恐惧更深。'
      }
    ]
  }
];
