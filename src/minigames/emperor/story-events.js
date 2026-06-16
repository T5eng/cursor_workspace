// 主线剧情事件：序章、章节、人物弧

export const NPC_LABELS = {
  yansong: '严嵩',
  xujie: '徐阶',
  taizi: '太子',
  empress: '方皇后',
  qijiguang: '戚继光',
  hairui: '海瑞',
  taoist: '陶仲文'
};

/** 序章三步，新局必触发 */
export const PROLOGUE = [
  {
    id: 'story_opening',
    category: 'power',
    story: true,
    title: '序章·西苑夜雨',
    text: '嘉靖二十一年，孟春。你于西苑暖阁批青词，窗外细雨如愁。吕公公跪报：「严阁老候驾已两个时辰；太子在乾清门外，说要进讲《孝经》。」案上还有三封密奏——倭寇破台州、河南饥民吃糠、钦天监奏彗星犯心。你知道，这一季不会再平静。',
    choices: [
      {
        label: '先见严嵩，稳住权臣',
        effects: { suspicion: -5, prestige: -4 },
        npc: { yansong: 12 },
        flag: 'met_yansong',
        result: '严嵩老泪纵横，呈上「瑞芝」与漕运账。你微笑接过，心知这是交易。'
      },
      {
        label: '先见太子，示以父子之情',
        effects: { prestige: 6, suspicion: 6 },
        npc: { taizi: 15, yansong: -8 },
        flag: 'met_taizi',
        result: '太子叩首，眼圈发红：「儿臣只盼父皇保重龙体。」你抚其肩，严府眼线已在廊下记录。'
      },
      {
        label: '谁都不见，先读密奏',
        effects: { prestige: 4, health: -4, treasury: -3 },
        npc: { xujie: 5 },
        result: '你连夜批红赈灾、调兵剿倭。天亮时，内阁才知陛下并未昏聩。'
      }
    ]
  },
  {
    id: 'story_palace_echo',
    category: 'palace',
    story: true,
    title: '序章·坤宁旧梦',
    text: '方皇后在帘后咳血。十年前壬寅宫变，她险些被废；如今坤宁宫与严府、东厂皆有来往。她低声道：「陛下若再不问政，这紫禁城便不是陛下的紫禁城。」',
    choices: [
      {
        label: '温言抚慰，赐药赏帛',
        effects: { health: -3, suspicion: -6 },
        npc: { empress: 12 },
        result: '皇后垂泪谢恩。你转身时，听见她吩咐宫女：「把太医院那方子备好。」'
      },
      {
        label: '冷声警告：后宫不得干政',
        effects: { prestige: 5, suspicion: 8 },
        npc: { empress: -15 },
        flag: 'empress_hostile',
        result: '皇后叩首称是，指尖发白。当晚坤宁宫灯火彻夜不熄。'
      },
      {
        label: '命徐阶暗查坤宁宫往来',
        check: { stat: 'prestige', dc: 52 },
        onSuccess: {
          effects: { suspicion: 6, prestige: 6 },
          npc: { xujie: 10, empress: -5 },
          result: '徐阶呈册：皇后宫监与严世蕃府中管事同名同籍。你没有立刻发作。'
        },
        onFail: {
          effects: { suspicion: 10 },
          result: '徐阶查案走漏风声，皇后先发制人，参你「疑忌中宫」。'
        }
      }
    ]
  },
  {
    id: 'story_omen',
    category: 'mystic',
    story: true,
    title: '序章·道士进京',
    text: '陶仲文入京，献《太平经》与丹方，称陛下乃「真武化身」。严嵩极力引荐；徐阶密奏「妖道乱政」。太子在门外求见，欲谏止炼丹。',
    choices: [
      {
        label: '拜陶仲文为国师，筑斋醮台',
        effects: { health: -6, treasury: -10, prestige: -5, suspicion: -4 },
        npc: { taoist: 20, yansong: 8, xujie: -10, taizi: -8 },
        flag: 'alchemy_deep',
        result: '青烟起西苑，道士称「圣心通天」。你感到一阵轻快，也感到离人间更远。'
      },
      {
        label: '留道士客居，暂不授官',
        effects: { health: -2, suspicion: 2 },
        npc: { taoist: 8, yansong: 3 },
        result: '陶仲文含笑谢恩。严嵩说陛下圣明；徐阶仍夜不能寐。'
      },
      {
        label: '斥退道士，准太子进讲',
        effects: { prestige: 8, health: -5, suspicion: 5 },
        npc: { taizi: 12, taoist: -15, yansong: -5, xujie: 8 },
        flag: 'qingliu_up',
        result: '太子讲《孝经》至「身体发肤」，你潸然泪下。陶仲文离京前留下一句：「陛下寿数，在丹不在德。」'
      }
    ]
  }
];

/** 章节里程碑：满足条件后优先于随机池 */
export const CHAPTERS = [
  {
    id: 'chapter_yansong_peak',
    beat: 'chapter_yansong_peak',
    when: { minYear: 22, flag: 'yansong_strong' },
    category: 'power',
    story: true,
    title: '第一章·严党顶峰',
    text: '严世蕃在京城纵马撞死郎中，巡城御史不敢拦。严嵩呈「请罪疏」，实则试探你是否还要用他。徐阶跪请彻查，东厂却呈太子门客与倭商往来「证据」。',
    choices: [
      {
        label: '罚世蕃俸，令严嵩闭门思过',
        effects: { prestige: 8, suspicion: 10, treasury: 5 },
        npc: { yansong: -10, xujie: 8 },
        clearFlag: 'yansong_strong',
        flag: 'yansong_weakened',
        result: '严嵩叩首如捣蒜。你知道他并未真倒，但至少朝堂暂息。'
      },
      {
        label: '压下此事，反参太子',
        effects: { prestige: -10, suspicion: 12, morale: -6 },
        npc: { yansong: 15, taizi: -20 },
        result: '太子被禁足东宫。严党弹冠相庆，你赢得片刻安静，输掉一世名声。'
      },
      {
        label: '设局，令两派互咬后一并收网',
        check: { stat: 'suspicion', dc: 60 },
        onSuccess: {
          effects: { prestige: 12, suspicion: -5 },
          npc: { xujie: 12, yansong: -8, taizi: -5 },
          flag: 'yansong_weakened',
          clearFlag: 'yansong_strong',
          result: '东厂与都察院同时上奏，严世蕃下狱，太子门客流放。你居中裁决，群臣看不透你的底牌。'
        },
        onFail: {
          effects: { suspicion: 15, health: -10 },
          result: '设局败露，严嵩与太子同时恨你。西苑门外，两拨人马暗中窥探。'
        }
      }
    ]
  },
  {
    id: 'chapter_wokou_climax',
    beat: 'chapter_wokou',
    when: { minYear: 23, flag: 'qijia_army' },
    category: 'war',
    story: true,
    title: '第二章·台州大捷之后',
    text: '戚继光大破倭寇于台州，俘首两千。捷报至，严嵩请封戚为都督同知；户部却称军饷已空。戚继光密奏：倭寇背后有江南豪强资助，名单涉及严党门生。',
    choices: [
      {
        label: '重赏戚家军，彻查资助倭寇者',
        effects: { treasury: -16, military: 12, prestige: 10, suspicion: 8 },
        npc: { qijiguang: 20, yansong: -15, xujie: 10 },
        flag: 'wokou_turning',
        result: '戚继光跪谢恩。数省大狱同开，严党有人下狱，有人逃亡。东南暂安。'
      },
      {
        label: '封赏从简，名单留中',
        effects: { treasury: -4, military: 4, prestige: -6 },
        npc: { qijiguang: -8, yansong: 8 },
        result: '戚继光沉默接诏。倭寇余孽潜入京师，名单成为悬顶之剑。'
      },
      {
        label: '召戚继光入京，亲自问策',
        check: { stat: 'military', dc: 55 },
        onSuccess: {
          effects: { military: 10, prestige: 8, health: -6 },
          npc: { qijiguang: 15 },
          flag: 'wokou_turning',
          result: '戚继光献《练兵疏》，你亲批「准行」。史载：帝武宗之后，罕见亲阅军务。'
        },
        onFail: {
          effects: { prestige: -5, military: -5 },
          result: '召见变成礼仪应酬，戚继光失望离京，倭患复炽。'
        }
      }
    ]
  },
  {
    id: 'chapter_empress_crisis',
    beat: 'chapter_empress',
    when: { minYear: 24, flag: 'empress_hostile' },
    category: 'palace',
    story: true,
    title: '第三章·坤宁宫火',
    text: '坤宁宫夜半起火，方皇后崩于火海。内侍供称见黑衣人；东厂称太子府小太监曾在附近出没。太子跪地痛哭：「儿臣绝无害母之理！」',
    choices: [
      {
        label: '以国丧礼葬，严查刺客',
        effects: { prestige: 6, suspicion: 10, morale: 4 },
        npc: { taizi: -10 },
        flag: 'empress_dead',
        result: '丧礼浩大，京师缟素。真凶未明，你与太子之间隔了一层血与灰。'
      },
      {
        label: '秘而不宣，称皇后病逝',
        effects: { suspicion: 8, prestige: -4 },
        flag: 'empress_dead',
        result: '宫门紧闭敛尸。野史记载：壬寅宫变之火，十年后重燃。'
      },
      {
        label: '亲自守灵，暂缓追究',
        effects: { prestige: 8, health: -10, suspicion: -5 },
        npc: { taizi: 8 },
        flag: 'empress_dead',
        result: '你守灵三日，太子伏棺而泣。朝臣称「陛下仁孝」，暗流暂退。'
      }
    ]
  },
  {
    id: 'chapter_hairui',
    beat: 'chapter_hairui',
    when: { minYear: 25, minStat: { morale: 35 } },
    category: 'power',
    story: true,
    title: '第四章·海瑞上疏',
    text: '海瑞抬棺上《治安疏》，骂你「嘉靖嘉靖，家家净也」，列十罪五骂。疏文一夜传遍京师。严嵩请族诛；徐阶请宽宥；太子说：「此臣子本分。」',
    choices: [
      {
        label: '下诏狱，永不录用',
        effects: { prestige: -10, morale: -12, suspicion: 5 },
        npc: { hairui: -30, yansong: 8, taizi: -5 },
        flag: 'hairui_jailed',
        result: '海瑞入狱。天下士子缄口，你心里知道他骂得字字属实。'
      },
      {
        label: '释海瑞，调其巡抚应天',
        effects: { prestige: 14, morale: 10, treasury: -6, suspicion: 10 },
        npc: { hairui: 25, xujie: 10, yansong: -12 },
        flag: 'hairui_free',
        result: '海瑞谢恩不出。次年江南清丈田亩，严党江南利益大损。'
      },
      {
        label: '不见，留中；暗中赏赐其母',
        effects: { prestige: 2, morale: 4, treasury: -4 },
        npc: { hairui: 5 },
        result: '海瑞仍被下狱数日方释。民间传：陛下嘴硬心软。'
      }
    ]
  },
  {
    id: 'chapter_elixir_crisis',
    beat: 'chapter_elixir',
    when: { minYear: 26, flag: 'alchemy_deep' },
    category: 'mystic',
    story: true,
    title: '第五章·铅汞入腹',
    text: '你连续服用「金丹」三月，须眉渐焦，喜怒无常。陶仲文请再进「大丹」；徐阶密奏丹有毒；太子请太医院会诊，被你斥退。',
    choices: [
      {
        label: '停丹养晦，召太医调理',
        effects: { health: 14, prestige: 6, suspicion: 4 },
        npc: { taizi: 8, taoist: -15, xujie: 6 },
        clearFlag: 'alchemy_deep',
        result: '你吐出血丝，惊觉生死一线。史载：帝自此稍理朝政。'
      },
      {
        label: '继续服丹，杀谏者以镇心',
        effects: { health: -18, prestige: -8, suspicion: 12 },
        npc: { taoist: 10, taizi: -15 },
        result: '两名御史伏尸殿外。你感到轻飘飘的，像踩在云上——云下是深渊。'
      },
      {
        label: '赐丹给严嵩，观其三日',
        check: { stat: 'prestige', dc: 58 },
        onSuccess: {
          effects: { health: 6, prestige: 8, suspicion: -4 },
          npc: { yansong: -20, taoist: -10 },
          clearFlag: 'alchemy_deep',
          result: '严嵩称疾不敢服。陶仲文连夜出逃，被你下令缉拿。'
        },
        onFail: {
          effects: { health: -12, suspicion: 10 },
          result: '严嵩佯服无恙，反参你「试毒于人」。道士趁乱再献「仙方」。'
        }
      }
    ]
  },
  {
    id: 'chapter_purge_yansong',
    beat: 'chapter_purge',
    when: { minYear: 28, flag: 'yansong_weakened', minStat: { prestige: 45 } },
    category: 'power',
    story: true,
    title: '第六章·倒严',
    text: '徐阶呈严嵩罪状三十条，连严世蕃通倭旧案一并翻出。严嵩脱去官服，赤足跪在西苑门外：「老臣只为陛下分忧啊。」',
    choices: [
      {
        label: '诏狱严世蕃，严嵩流放袁州',
        effects: { prestige: 12, morale: 8, suspicion: 8, treasury: 10 },
        npc: { yansong: -40, xujie: 20 },
        flag: 'yansong_fallen',
        clearFlag: 'yansong_weakened',
        result: '严世蕃斩于市曹。严嵩在流放途中写青词求你，你没有回一个字。'
      },
      {
        label: '留严嵩京邸养老，只诛世蕃',
        effects: { prestige: 4, suspicion: 12 },
        npc: { yansong: -15, xujie: -5 },
        flag: 'yansong_fallen',
        result: '严嵩苟活，清流不满。你知道他仍有门生故吏遍布天下。'
      },
      {
        label: '暂押，欲取其藏金填国库',
        check: { stat: 'treasury', dc: 56 },
        onSuccess: {
          effects: { treasury: 22, prestige: 6, suspicion: 6 },
          flag: 'yansong_fallen',
          result: '抄出家财百万两。严嵩骂你「负心」，你说「朕负天下，不负国库」。'
        },
        onFail: {
          effects: { treasury: -8, suspicion: 10 },
          result: '严家提前转移财产，你只得杀世蕃泄愤，国库仍空。'
        }
      }
    ]
  },
  {
    id: 'chapter_final_choice',
    beat: 'chapter_finale',
    when: { minYear: 32, minStat: { health: 40 } },
    category: 'mystic',
    story: true,
    title: '终章·天道问心',
    text: '嘉靖三十二年冬。你梦见了太祖、成祖与仁宗。太祖问：「天下可安？」成祖问：「疆土可固？」仁宗问：「百姓可饱？」你独坐西苑，手中是退位诏草稿，案上是太子请监国疏。',
    choices: [
      {
        label: '传位太子，自居上皇修道',
        effects: { health: 10, prestige: 8, suspicion: -10 },
        npc: { taizi: 25 },
        flag: 'abdicated',
        result: '太子即位，你迁居西苑。史评褒贬不一，但你终于睡了一觉无梦的长觉。'
      },
      {
        label: '撕诏，亲政三年，整顿吏治',
        effects: { health: -12, prestige: 14, morale: 10, treasury: -10 },
        npc: { xujie: 15, taizi: 5 },
        flag: 'late_reform',
        result: '你第一次连续上朝七日。群臣惶恐又欣慰：陛下回来了，哪怕只有三年。'
      },
      {
        label: '维持现状，继续在西苑炼丹',
        effects: { health: -8, prestige: -6, suspicion: 6 },
        flag: 'status_quo',
        result: '诏草稿付之一炬。你继续看云、写字、服丹。江山依旧，人心已远。'
      }
    ]
  }
];

/** 补充剧情随机事件（权重略高） */
export const STORY_FLAVOR = [
  {
    id: 'story_taizi_worry',
    category: 'palace',
    weight: 14,
    when: { minYear: 22, minStat: { suspicion: 40 } },
    title: '东宫夜哭',
    text: '内侍报：太子在东宫设灵位，祭拜生母章圣皇太后，却不敢哭出声。景王朱载圳在城外猎鹰，扬言「兄友弟恭，何哭为」。',
    choices: [
      {
        label: '召太子入宫，父子对饮',
        effects: { suspicion: -6, health: -4 },
        npc: { taizi: 12 },
        result: '太子醉后言「儿臣只怕活不到父皇驾崩」。你掷杯止言，彻夜未眠。'
      },
      {
        label: '申斥景王，禁其出城',
        effects: { prestige: 5, suspicion: 8 },
        npc: { taizi: 5 },
        result: '景王跪谢，眼神却更冷。'
      },
      {
        label: '两王各罚俸半年',
        effects: { prestige: 3, treasury: 6 },
        result: '兄弟同罚，朝臣称公允，兄弟同心恨你。'
      }
    ]
  },
  {
    id: 'story_xujie_secret',
    category: 'power',
    weight: 12,
    when: { flag: 'qingliu_up' },
    title: '徐阶密谒',
    text: '徐阶夜谒西苑，呈严嵩罪证簿，却请求「勿急，恐狗急跳墙」。他低声：「臣愿为陛下剑，剑出必见血。」',
    choices: [
      {
        label: '准其徐徐图之',
        effects: { suspicion: 5, prestige: 4 },
        npc: { xujie: 15 },
        flag: 'xujie_sword',
        result: '徐阶叩首而退。你知道这把剑迟早要挥向严嵩。'
      },
      {
        label: '令他立刻上奏',
        effects: { prestige: 6, suspicion: 12 },
        npc: { xujie: -5, yansong: -10 },
        result: '严嵩反咬徐阶结党，朝堂大乱。'
      },
      {
        label: '疑其邀功，婉拒',
        effects: { suspicion: -3, prestige: -4 },
        npc: { xujie: -12 },
        result: '徐阶默然离去。清流说你「昏聩依旧」。'
      }
    ]
  },
  {
    id: 'story_border_letter',
    category: 'war',
    weight: 11,
    when: { minYear: 24 },
    title: '血书边报',
    text: '宣府守将血书呈：鞑靼围城，士卒缺饷三月。奏疏被严党门生截留月余，今日方到御前。',
    choices: [
      {
        label: '斩截留者，即刻发饷',
        effects: { treasury: -14, military: 10, prestige: 8, suspicion: 6 },
        result: '边军欢呼「陛下万岁」。截留御史抄家，严党人人自危。'
      },
      {
        label: '令严嵩督办军饷',
        check: { stat: 'treasury', dc: 50 },
        onSuccess: { effects: { military: 6, treasury: -8, suspicion: 4 }, result: '军饷到了，严嵩又贪一笔。至少城没破。' },
        onFail: { effects: { military: -12, morale: -8 }, result: '宣府陷落，守将殉国。血书成为绝唱。' }
      },
      {
        label: '议和纳贡',
        effects: { treasury: -10, military: -8, prestige: -10, morale: -6 },
        result: '鞑靼退兵，史书多一笔「嘉靖纳贡」。'
      }
    ]
  },
  {
    id: 'story_famine_child',
    category: 'disaster',
    weight: 13,
    when: { maxStat: { morale: 45 } },
    title: '童卖自身',
    text: '河南饥民鬻儿鬻女入京，幼童跪在西苑外，举牌「卖身葬父」。牌上写着：嘉靖二十一年秋，父饿死，母改嫁。',
    choices: [
      {
        label: '内帑赎人，安置善堂',
        effects: { treasury: -12, morale: 14, prestige: 8, health: -3 },
        result: '幼童叩头出血。你回宫后，把青词纸揉成一团。'
      },
      {
        label: '令地方官赈济，不见童',
        effects: { morale: 4, prestige: -4, treasury: -6 },
        result: '诏书下去，童却已被牙婆领走。'
      },
      {
        label: '驱离，免扰清修',
        effects: { morale: -14, prestige: -12 },
        result: '侍卫驱赶，童哭喊「皇帝！皇帝！」声音跟着雨一起下。'
      }
    ]
  },
  {
    id: 'story_prophecy_lan',
    category: 'mystic',
    weight: 10,
    when: { minYear: 23 },
    title: '兰妃谶语',
    text: '钦天监奏：有女自海外来，号「兰妃」，能言祸福。京师传言：「嘉靖嘉靖，兰灵入宫则净。」东厂请拿人，陶仲文请迎入观。',
    choices: [
      {
        label: '拿入诏狱，称妖女',
        effects: { suspicion: 8, prestige: 2, morale: -4 },
        result: '女子入狱，狱中仍唱「家家净也」。你听了，砸碎一只丹炉。'
      },
      {
        label: '迎入西苑，听其谶语',
        effects: { health: -8, suspicion: 6, prestige: -5 },
        npc: { taoist: 8 },
        flag: 'lan_prophecy',
        result: '女子道：「陛下若再服丹三年，则家家净矣。」次日她失踪，只留下一缕兰香。'
      },
      {
        label: '驱逐出京，不许入境',
        effects: { prestige: 4, morale: 3 },
        result: '女子笑而去。数年后，此谶与《治安疏》并传天下。'
      }
    ]
  },
  {
    id: 'story_eunuch_loyal',
    category: 'palace',
    weight: 9,
    when: { flag: 'dongchang_active' },
    title: '太监忠奸',
    text: '掌印太监呈东厂密档：太子近臣与宫女私通，欲构陷景王。又附景王贿赂厂卫名单。他说：「奴婢只知尽忠于陛下一人。」',
    choices: [
      {
        label: '两份档案同时销毁',
        effects: { suspicion: -5, prestige: 3 },
        npc: { taizi: 5 },
        result: '太监愣住，继而磕头：「陛下圣明。」你知道他在怕。'
      },
      {
        label: '先诛太子近臣',
        effects: { suspicion: 10, prestige: -4 },
        npc: { taizi: -18 },
        result: '东宫血流。太子上表求死，你没有准。'
      },
      {
        label: '利用档案，令两派互相牵制',
        check: { stat: 'suspicion', dc: 57 },
        onSuccess: { effects: { suspicion: -8, prestige: 6 }, result: '太子与景王同时收敛。东厂权力更盛，你更孤独。' },
        onFail: { effects: { suspicion: 12, health: -8 }, result: '档案外泄，两王联手参东厂，厂卫反噬。' }
      }
    ]
  }
];
