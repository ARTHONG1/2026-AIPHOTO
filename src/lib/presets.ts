// Preset catalog shared by the UI and the server action.
// The server only ever resolves assets through these ids, never client paths.

export type PresetCategory = { id: string; label: string };

export type Preset = {
  id: string;
  name: string;
  category: string;
  /** English description of the reference image, sent to the image model with it. */
  prompt: string;
  /** Small preview shown in the UI. */
  thumb?: string;
  /** Reference image sent to the model (under /public). */
  ref?: string;
};

// ---------- backgrounds ----------
export const BACKGROUND_CATEGORIES: PresetCategory[] = [
  { id: 'space', label: '우주' },
  { id: 'nature', label: '자연' },
  { id: 'lab', label: '실험실' },
  { id: 'adventure', label: '탐험' },
];

const bgImage = (id: string, name: string, category: string, prompt: string): Preset => ({
  id,
  name,
  category,
  prompt,
  thumb: '/presets/backgrounds/' + id + '.webp',
  ref: '/presets/backgrounds/ref/' + id + '.jpg',
});

export const BACKGROUNDS: Preset[] = [
  bgImage('space-galaxy', '은하수 우주', 'space', 'deep space with a glowing spiral galaxy, nebula clouds and stars'),
  bgImage('future-lab', '미래 실험실', 'lab', 'a bright futuristic science laboratory with holographic screens'),
  bgImage('dino-dig', '공룡 발굴 현장', 'adventure', 'an archaeological dig site with dinosaur fossils in the ground'),
  bgImage('river-valley', '강이 흐르는 계곡', 'nature', 'a green valley with a clear winding river'),
  bgImage('sunset-beach', '노을 바다', 'nature', 'a calm beach at sunset with golden light on the waves'),
  bgImage('moon-surface', '달 표면', 'space', 'the grey cratered surface of the Moon with Earth rising on the black horizon'),
  bgImage('mars-base', '화성 기지', 'space', 'a red Martian desert with a futuristic dome research base and rover'),
  bgImage('space-station', '우주 정거장', 'space', 'inside an orbital space station module with a large window showing Earth'),
  bgImage('saturn-rings', '토성 고리', 'space', 'close view of Saturn and its bright rings filling the starry sky'),
  bgImage('black-hole', '블랙홀', 'space', 'a glowing black hole accretion disk bending starlight in deep space'),
  bgImage('aurora', '오로라 밤하늘', 'space', 'a snowy field under a sky full of green and purple aurora'),
  bgImage('observatory', '천문대', 'space', 'inside an observatory dome with a large telescope pointing at the starry sky'),
  bgImage('launchpad', '로켓 발사대', 'space', 'a rocket launch pad with a tall rocket and clouds of launch smoke'),
  bgImage('volcano', '화산 관측', 'nature', 'a safe viewpoint in front of an erupting volcano with glowing lava rivers'),
  bgImage('deep-sea', '깊은 바다', 'nature', 'the deep ocean with bioluminescent jellyfish and a research submarine light'),
  bgImage('coral-reef', '산호초', 'nature', 'a colorful coral reef underwater with tropical fish and sunbeams'),
  bgImage('rainforest', '열대우림', 'nature', 'a lush tropical rainforest with giant leaves, vines and a waterfall'),
  bgImage('glacier', '빙하', 'nature', 'a vast blue glacier and icebergs under a clear polar sky'),
  bgImage('desert-dunes', '사막 모래언덕', 'nature', 'golden desert sand dunes under a bright blue sky'),
  bgImage('greenhouse', '식물원 온실', 'nature', 'a sunny glass greenhouse full of exotic plants and flowers'),
  bgImage('robot-factory', '로봇 공장', 'lab', 'a clean robot factory with robotic arms assembling friendly robots'),
  bgImage('chemistry-lab', '화학 실험실', 'lab', 'a school chemistry lab with colorful bubbling flasks and glassware'),
  bgImage('tesla-lightning', '번개 실험실', 'lab', 'a physics lab with a large Tesla coil throwing purple electric sparks safely behind glass'),
  bgImage('dna-lab', '유전자 연구소', 'lab', 'a modern genetics lab with a giant glowing DNA double helix hologram'),
  bgImage('cell-world', '현미경 속 세포', 'lab', 'a magnified microscopic world of colorful cells as if standing inside a microscope slide'),
  bgImage('ai-datacenter', '인공지능 데이터센터', 'lab', 'a futuristic AI data center with glowing server racks and flowing light lines'),
  bgImage('crystal-cave', '수정 동굴', 'adventure', 'a giant cave filled with huge glowing crystals'),
  bgImage('jurassic', '쥐라기 숲', 'adventure', 'a prehistoric Jurassic forest with friendly long-neck dinosaurs in the distance'),
  bgImage('science-fair', '과학 축제', 'adventure', 'a lively school science fair hall with posters, models and balloons'),
  bgImage('museum-hall', '자연사 박물관', 'adventure', 'a grand natural history museum hall with a huge dinosaur skeleton'),
  bgImage('storm-chase', '폭풍 관측', 'adventure', 'a weather research station watching a distant tornado under dramatic clouds'),
  bgImage('neon-city', '미래 도시', 'adventure', 'a futuristic city at night with flying cars and neon lights'),
];

// ---------- poses ----------
export const POSE_CATEGORIES: PresetCategory[] = [
  { id: 'classic', label: '인기' },
  { id: 'fun', label: '신나게' },
  { id: 'sport', label: '운동' },
  { id: 'science', label: '과학자' },
];

// All poses are drawn from scripts/pose-geometry.mjs: a colored SVG for the card and a
// plain black-on-white PNG guide for the model.
const pose = (id: string, name: string, category: string, prompt: string): Preset => ({
  id,
  name,
  category,
  prompt,
  thumb: '/presets/poses/' + id + '.svg',
  ref: '/presets/poses/ref/' + id + '.png',
});

export const POSES: Preset[] = [
  pose('raise-hands', '만세', 'classic', 'both arms raised high above the head in celebration'),
  pose('heart', '하트', 'classic', 'making a heart shape with both hands in front of the chest'),
  pose('v-sign', '브이', 'classic', 'one hand making a V sign near the face'),
  pose('thumbs-up', '엄지척', 'classic', 'giving a thumbs up with one hand'),
  pose('wave', '손 흔들기', 'classic', 'waving one open hand at the camera'),
  pose('camera', '찰칵', 'classic', 'holding hands like taking a photo with an imaginary camera'),
  pose('arms-crossed', '팔짱', 'classic', 'arms crossed confidently over the chest'),
  pose('hands-on-hips', '허리에 손', 'classic', 'both hands on the hips, standing proudly'),
  pose('double-v', '양손 브이', 'classic', 'V signs with both hands beside the face'),
  pose('heart-head', '머리 위 하트', 'classic', 'arms curved over the head forming a big heart'),
  pose('bow', '인사하기', 'classic', 'a polite bow with hands together'),
  pose('point', '가리키기', 'science', 'pointing forward with one index finger'),
  pose('think', '생각하기', 'science', 'hand on the chin in a thinking pose'),
  pose('presenter', '발표하기', 'science', 'presenting with one open palm as if explaining an experiment'),
  pose('head-scratch', '갸우뚱', 'science', 'scratching the head with one hand, curious'),
  pose('binoculars', '쌍안경', 'science', 'hands around the eyes like looking through binoculars'),
  pose('salute', '경례', 'science', 'saluting with one hand at the forehead'),
  pose('rocket-launch', '로켓 발사', 'science', 'both arms straight up with palms together like a rocket'),
  pose('astronaut-float', '우주 유영', 'science', 'floating weightlessly with arms and legs spread like an astronaut'),
  pose('shush', '쉿!', 'fun', 'index finger over the lips, saying shh'),
  pose('surprise', '깜짝!', 'fun', 'both hands raised beside the face in surprise'),
  pose('victory', '승리', 'fun', 'one fist pumped high in victory'),
  pose('superhero-fly', '슈퍼히어로', 'fun', 'one fist stretched straight up like a flying superhero'),
  pose('robot-dance', '로봇 춤', 'fun', 'stiff robot dance with arms bent at right angles'),
  pose('disco', '디스코', 'fun', 'disco pose with one finger pointing up to the sky'),
  pose('dab', '댑', 'fun', 'a dab pose with one arm stretched diagonally'),
  pose('zap', '찌릿찌릿', 'fun', 'arms out with playful electric sparkles around the body'),
  pose('x-arms', '엑스', 'fun', 'forearms crossed in an X in front of the chest'),
  pose('airplane', '비행기', 'fun', 'arms stretched out to the sides like airplane wings'),
  pose('clap', '박수', 'fun', 'clapping hands in front of the chest'),
  pose('high-five', '하이파이브', 'fun', 'one hand raised for a high five'),
  pose('stop', '멈춰!', 'fun', 'one palm pushed forward toward the camera like stop'),
  pose('throw', '던지기', 'sport', 'throwing a ball overhand'),
  pose('run', '달리기', 'sport', 'running dynamically with arms swinging'),
  pose('jump-legacy', '점프', 'sport', 'jumping in the air'),
  pose('tuck-jump', '점프 업', 'sport', 'a high tuck jump with knees up'),
  pose('boxing', '권투', 'sport', 'boxing guard with both fists up'),
  pose('kick', '발차기', 'sport', 'a high side kick'),
  pose('flex', '힘자랑', 'sport', 'flexing both arm muscles'),
  pose('t-pose', '티 포즈', 'sport', 'arms stretched straight out to the sides in a T'),
  pose('ballet', '발레', 'sport', 'a graceful ballet pose with one arm arched overhead'),
  pose('tree-yoga', '나무 자세', 'sport', 'yoga tree pose on one leg with arms above the head'),
  pose('squat', '쪼그려 앉기', 'sport', 'a low squat with hands forward'),
  pose('stretch', '옆구리 스트레칭', 'sport', 'a side stretch with one arm reaching over the head'),
];

// ---------- props ----------
export const PROP_CATEGORIES: PresetCategory[] = [
  { id: 'wear', label: '입기' },
  { id: 'head', label: '머리' },
  { id: 'hold', label: '들기' },
  { id: 'magic', label: '특수효과' },
];

export const MAX_PROPS = 3;

const propImage = (id: string, name: string, category: string, prompt: string): Preset => ({
  id,
  name,
  category,
  prompt,
  thumb: '/presets/props/' + id + '.webp',
  ref: '/presets/props/ref/' + id + '.png',
});

export const PROPS: Preset[] = [
  propImage('ai-glasses', 'AI 안경', 'head', 'wearing this pair of futuristic AI engineering glasses on the face'),
  propImage('science-tee', '과학 티셔츠', 'wear', 'wearing this T-shirt instead of the current top'),
  propImage('einstein-wig', '아인슈타인 머리', 'head', 'wearing this wig on the head to look like Einstein'),
  propImage('cyber-helmet', '사이버 마스크', 'head', 'wearing this futuristic mask on the face'),
  propImage('lab-coat', '실험 가운', 'wear', 'wearing a clean white scientist lab coat over the clothes'),
  propImage('astronaut-suit', '우주복', 'wear', 'wearing a white astronaut suit without a helmet, face fully visible'),
  propImage('hero-cape', '과학 히어로 망토', 'wear', 'wearing a red superhero cape with an atom symbol'),
  propImage('bow-tie', '나비넥타이', 'wear', 'wearing a neat red bow tie'),
  propImage('nobel-medal', '금메달', 'wear', 'wearing a shiny gold medal on a ribbon around the neck'),
  propImage('jetpack', '제트팩', 'wear', 'wearing a small silver jetpack on the back with soft blue flames'),
  propImage('robot-arm', '로봇 팔', 'wear', 'one arm replaced by a sleek white robotic arm'),
  propImage('lab-gloves', '실험 장갑', 'wear', 'wearing blue laboratory gloves'),
  propImage('safety-goggles', '보안경', 'head', 'wearing clear laboratory safety goggles'),
  propImage('astronaut-helmet', '우주 헬멧', 'head', 'wearing an open astronaut helmet with a clear visor, face fully visible'),
  propImage('vr-headset', 'VR 헤드셋', 'head', 'wearing a sleek VR headset pushed up on the forehead so the eyes stay visible'),
  propImage('graduation-cap', '학사모', 'head', 'wearing a black graduation cap'),
  propImage('explorer-hat', '탐험가 모자', 'head', 'wearing a khaki explorer safari hat'),
  propImage('circuit-crown', '회로 왕관', 'head', 'wearing a glowing crown made of circuit boards'),
  propImage('microscope', '현미경', 'hold', 'holding a small white microscope'),
  propImage('telescope', '망원경', 'hold', 'holding a brass telescope'),
  propImage('beaker', '부글부글 비커', 'hold', 'holding a glass beaker with bubbling colorful liquid'),
  propImage('magnifier', '돋보기', 'hold', 'holding a large magnifying glass'),
  propImage('model-rocket', '모형 로켓', 'hold', 'holding a toy model rocket'),
  propImage('dna-model', 'DNA 모형', 'hold', 'holding a colorful DNA double helix model'),
  propImage('magnet', '말굽자석', 'hold', 'holding a big red horseshoe magnet'),
  propImage('dino-fossil', '공룡 화석', 'hold', 'holding a dinosaur fossil bone'),
  propImage('butterfly-net', '곤충 채집망', 'hold', 'holding a butterfly net with a butterfly nearby'),
  propImage('robot-pet', '로봇 강아지', 'hold', 'with a cute small robot dog beside them'),
  propImage('drone', '드론', 'magic', 'with a small quadcopter drone hovering near the shoulder'),
  propImage('plasma-ball', '플라스마 볼', 'magic', 'holding a glowing plasma ball with purple light filaments'),
  propImage('planet-orbit', '떠다니는 행성', 'magic', 'with small planets orbiting around the head'),
  propImage('light-bulb', '번뜩 아이디어', 'magic', 'with a glowing idea light bulb floating above the head'),
];

const byId = (list: Preset[]) => new Map(list.map((p) => [p.id, p]));
const BACKGROUND_MAP = byId(BACKGROUNDS);
const POSE_MAP = byId(POSES);
const PROP_MAP = byId(PROPS);

export const findBackground = (id?: string | null) => (id ? BACKGROUND_MAP.get(id) : undefined);
export const findPose = (id?: string | null) => (id ? POSE_MAP.get(id) : undefined);
export const findProp = (id?: string | null) => (id ? PROP_MAP.get(id) : undefined);
