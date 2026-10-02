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
  /** Short plain-Korean explanation shown under the name (used for camera terms). */
  desc?: string;
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
  thumb: '/presets/backgrounds/' + id + '.avif',
  ref: '/presets/backgrounds/ref/' + id + '.webp',
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
  bgImage('jupiter-europa', '목성과 유로파', 'space', 'the icy cracked surface of Jupiter\'s moon Europa with giant striped Jupiter filling the starry sky'),
  bgImage('nebula', '성운 속 우주', 'space', 'a rocky asteroid ledge floating inside a huge colorful glowing nebula with newborn stars'),
  bgImage('twin-suns', '쌍둥이 태양 행성', 'space', 'an alien desert planet with tall rock arches under two setting suns'),
  bgImage('comet-surface', '혜성 위', 'space', 'the dark icy surface of a comet with glittering gas jets and a long glowing tail across the stars'),
  bgImage('meteor-shower', '별똥별 밤', 'space', 'a grassy hilltop with a telescope at night under a spectacular meteor shower and the Milky Way'),
  bgImage('geyser', '간헐천', 'nature', 'a geothermal valley with an erupting geyser and colorful steaming hot springs'),
  bgImage('canyon-layers', '지층 협곡', 'nature', 'a canyon floor between towering red rock walls with clearly visible colorful rock layers'),
  bgImage('glow-forest', '빛나는 버섯 숲', 'nature', 'a dark forest at night lit by bioluminescent glowing mushrooms and fireflies'),
  bgImage('mudflat', '서해 갯벌', 'nature', 'a wide Korean west-coast tidal mudflat at low tide with shiny tidal channels at sunset'),
  bgImage('quantum-computer', '양자컴퓨터 연구소', 'lab', 'a quantum computing lab with a golden chandelier-shaped dilution refrigerator and blue-lit racks'),
  bgImage('mission-control', '우주 관제센터', 'lab', 'a space mission control room with rows of glowing consoles and a giant launch screen'),
  bgImage('fusion-reactor', '핵융합 연구소', 'lab', 'a fusion research hall in front of a giant tokamak reactor with a glowing pink-violet plasma ring'),
  bgImage('particle-collider', '입자가속기', 'lab', 'a long curved particle accelerator tunnel with a huge blue magnet pipe'),
  bgImage('ai-classroom', '미래 AI 교실', 'lab', 'a bright futuristic classroom with floating holographic screens and a friendly robot teacher'),
  bgImage('submarine', '심해 잠수정', 'adventure', 'inside a deep-sea submarine cockpit with a big round window full of glowing sea creatures'),
  bgImage('floating-islands', '하늘 섬', 'adventure', 'a grassy floating island in the sky with waterfalls pouring off other floating islands'),
  bgImage('underwater-dome', '해저 연구 기지', 'adventure', 'inside a glass-domed underwater research base with fish, coral and sea turtles outside'),
  bgImage('time-portal', '타임머신 연구소', 'adventure', 'a steampunk time machine lab with a giant glowing swirling time portal, gears and clocks'),
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
  pose('eureka', '유레카!', 'science', 'one index finger raised beside the head as if a great idea just came'),
  pose('look-far', '멀리 보기', 'science', 'one hand held flat above the eyes like a visor, looking into the distance'),
  pose('finger-guns', '빵야', 'fun', 'both hands making finger guns pointing outward at chest height'),
  pose('double-wave', '양손 흔들기', 'classic', 'both hands raised high and waving at the camera'),
  pose('shrug', '으쓱', 'fun', 'shrugging with both palms turned up and elbows bent'),
  pose('energy-blast', '에너지 발사', 'fun', 'both palms pushed out to one side together as if firing an energy blast'),
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
  thumb: '/presets/props/' + id + '.avif',
  ref: '/presets/props/ref/' + id + '.webp',
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
  propImage('globe', '지구본', 'hold', 'holding a classic world globe on a brass stand'),
  propImage('prism', '프리즘', 'hold', 'holding a glass prism that splits light into a bright rainbow'),
  propImage('newton-cradle', '뉴턴의 요람', 'hold', 'holding a chrome Newton\'s cradle with one ball swinging'),
  propImage('geode', '자수정 원석', 'hold', 'holding a split amethyst geode with sparkling purple crystals'),
  propImage('satellite-model', '인공위성 모형', 'hold', 'holding a model satellite with golden foil and blue solar panels'),
  propImage('mars-rover', '화성 탐사 로버', 'hold', 'holding a toy model of a six-wheeled Mars rover'),
  propImage('test-tubes', '시험관 세트', 'hold', 'holding a wooden rack of test tubes filled with rainbow-colored liquids'),
  propImage('volcano-model', '화산 실험', 'hold', 'holding a model volcano erupting with foamy red lava'),
  propImage('stethoscope', '청진기', 'wear', 'wearing a stethoscope around the neck'),
  propImage('headlamp', '헤드램프', 'head', 'wearing a bright glowing LED headlamp on the forehead'),
  propImage('eeg-cap', '뇌파 측정 모자', 'head', 'wearing an EEG brainwave cap with small colorful electrodes, face fully visible'),
  propImage('propeller-cap', '프로펠러 모자', 'head', 'wearing a colorful propeller beanie cap'),
  propImage('pilot-headset', '관제 헤드셋', 'head', 'wearing a mission control headset with a boom microphone'),
  propImage('exoskeleton', '웨어러블 로봇', 'wear', 'wearing a sleek white robotic exoskeleton on the shoulders and arms'),
  propImage('flight-jacket', '우주비행사 재킷', 'wear', 'wearing an orange astronaut flight jacket with round mission patches'),
  propImage('solar-wings', '태양광 날개', 'wear', 'wearing a backpack with two unfolded solar-panel wings'),
  propImage('hologram-earth', '홀로그램 지구', 'magic', 'with a glowing blue hologram of the Earth floating above one open hand'),
  propImage('mini-ufo', '미니 UFO', 'magic', 'with a small shiny flying saucer with glowing lights hovering beside the head'),
];

const byId = (list: Preset[]) => new Map(list.map((p) => [p.id, p]));
const BACKGROUND_MAP = byId(BACKGROUNDS);
const POSE_MAP = byId(POSES);
const PROP_MAP = byId(PROPS);

export const findBackground = (id?: string | null) => (id ? BACKGROUND_MAP.get(id) : undefined);
export const findPose = (id?: string | null) => (id ? POSE_MAP.get(id) : undefined);
export const findProp = (id?: string | null) => (id ? PROP_MAP.get(id) : undefined);

// ---------- compositions (camera framing) ----------
// Real photography techniques only. Text-only for the model: a sketch of a framed mannequin
// would fight the chosen pose. Cards are pencil storyboards from scripts/composition-geometry.mjs.
export const COMPOSITION_CATEGORIES: PresetCategory[] = [
  { id: 'zoom', label: '줌인·줌아웃' },
  { id: 'angle', label: '카메라 각도' },
  { id: 'layout', label: '자리 잡기' },
  { id: 'lens', label: '렌즈' },
  { id: 'light', label: '빛과 노출' },
  { id: 'shutter', label: '셔터와 특수 기법' },
];

const composition = (id: string, name: string, category: string, desc: string, prompt: string): Preset => ({
  id,
  name,
  category,
  desc,
  prompt,
  thumb: '/presets/compositions/' + id + '.svg',
});

export const COMPOSITIONS: Preset[] = [
  // zoom
  composition('extreme-close-up', '익스트림 클로즈업', 'zoom', '눈과 표정만 가득',
    'EXTREME CLOSE-UP: frame tightly on the face from the eyebrows to the chin (the top of the head may be cropped); the eyes, skin texture and expression fill the frame and the scene shows only as soft color and light behind'),
  composition('close-up', '클로즈업', 'zoom', '얼굴을 크게 (줌인)',
    'CLOSE-UP (zoomed in): frame from just above the top of the head to just below the shoulders. The face fills most of the frame and is perfectly sharp; the scene shows only as a softly blurred background around the head'),
  composition('bust-shot', '바스트샷', 'zoom', '가슴 위까지',
    'BUST SHOT: frame from just above the head to the middle of the chest. The face is large and sharp, with the scene visible behind the shoulders'),
  composition('waist-shot', '웨이스트샷', 'zoom', '허리 위까지',
    'WAIST SHOT: frame from just above the head to the waist, with the scene visible on both sides of PERSON A'),
  composition('knee-shot', '니샷', 'zoom', '무릎 위까지',
    'KNEE SHOT: frame from just above the head to just below the knees'),
  composition('full-shot', '풀샷', 'zoom', '머리부터 발끝까지',
    'FULL SHOT: the whole body from head to feet is inside the frame with a little space above the head and below the feet, both feet standing on the ground of the scene'),
  composition('long-shot', '롱샷', 'zoom', '배경을 넓게 (줌아웃)',
    'LONG SHOT (zoomed far out): an extreme wide establishing shot taken with a wide-angle lens from about 10 meters away. PERSON A is small: their whole body, head to feet, is only about 30 percent of the frame height, standing in the lower middle third, and the wide scene with lots of open space above and around them fills the rest of the frame. Do not enlarge PERSON A to show the face bigger; the small size is the point of this shot. Keep the face well lit and in focus even though it is small'),
  composition('extreme-long-shot', '익스트림 롱샷', 'zoom', '대자연 속 아주 작은 나',
    'EXTREME LONG SHOT: a vast establishing view from far away; PERSON A is tiny, about 12 percent of the frame height, standing in the lower third, and the huge scene dominates the picture. Do not enlarge PERSON A'),
  // camera angle
  composition('eye-level', '아이레벨', 'angle', '눈높이에서 정면으로',
    'EYE LEVEL: the camera is exactly at the height of PERSON A eyes, level and straight on with no tilt, for a natural and honest perspective. Frame from the head to the knees'),
  composition('high-angle', '하이앵글', 'angle', '위에서 내려다보기',
    'HIGH ANGLE (looking down): the camera is held about 1 meter above the head of PERSON A and tilts down about 40 degrees. Show strong downward perspective: the head and shoulders are nearer and look larger, the body narrows toward the feet, and the ground or floor of the scene fills the background instead of the sky. PERSON A looks up toward the lens, so the face is clearly visible. Full body, head to feet'),
  composition('low-angle', '로우앵글', 'angle', '아래에서 올려다보기',
    'LOW ANGLE (looking up): the camera sits close to the ground, about 40 cm high, and tilts up about 30 degrees at PERSON A. Show strong upward perspective: the shoes and legs are nearer and look larger, the head is farther away, the horizon sits in the bottom quarter of the frame and the sky or ceiling of the scene fills the top. PERSON A towers over the camera like a hero and looks down slightly toward the lens. Full body, head to feet, with the face clearly visible'),
  composition('birds-eye', '버드아이뷰', 'angle', '바로 위에서 수직으로',
    "BIRD'S-EYE VIEW: the camera is directly overhead, about 3 meters up, pointing straight down. We see the top of the head and the shoulders, PERSON A looks straight up into the lens so the face is visible, and the ground of the scene spreads around them like a map"),
  composition('worms-eye', '웜즈아이뷰', 'angle', '바닥에서 하늘로',
    "WORM'S-EYE VIEW: the camera lies on the ground right in front of the feet, pointing almost straight up. Extreme upward perspective: the shoes are huge in the foreground, PERSON A towers into the sky or ceiling of the scene and looks down at the lens"),
  composition('dutch-angle', '더치앵글', 'angle', '비스듬히 기울여 역동적으로',
    // The tilt itself is applied after generation (see COMPOSITION_FINISHERS); the model only leaves room for the crop.
    'DUTCH ANGLE: an energetic, dynamic shot. Frame from the head to the knees with generous space around PERSON A on every side and the head well below the top edge, because the finished picture is rotated and cropped afterwards. Keep PERSON A near the center of the frame'),
  composition('three-quarter', '쓰리쿼터', 'angle', '45도 비스듬히',
    'THREE-QUARTER VIEW: the camera stands 45 degrees to one side; PERSON A turns the body slightly away but keeps the face toward the lens at a three-quarter angle, giving depth to the face. Frame from the head to mid-thigh'),
  composition('profile', '프로필', 'angle', '옆모습 라인',
    'PROFILE VIEW: the camera stands 90 degrees to the side; PERSON A is seen in a clean side profile looking across the frame toward the open side of the scene, with the outline of the forehead, nose, lips and chin clearly visible. Frame from the head to the knees'),
  composition('aerial', '에어리얼', 'angle', '드론으로 높이서',
    'AERIAL DRONE SHOT: from a drone high above and in front, looking down at about 45 degrees; PERSON A is small in the middle of the wide landscape, looking up and waving at the drone so the face catches the light'),
  // layout
  composition('rule-of-thirds', '3분할 구도', 'layout', '한쪽에 서서 배경과 함께',
    'RULE OF THIRDS: frame from the head to the knees with PERSON A standing on the left third line of the frame, not in the center; the open right side shows the most interesting part of the scene'),
  composition('center-frame', '중앙 대칭 구도', 'layout', '가운데에 반듯하게',
    'CENTERED SYMMETRY: PERSON A stands exactly in the middle of the frame, facing the camera straight on, with the scene arranged evenly on both sides. Frame from the head to the knees'),
  composition('golden-ratio', '황금비 구도', 'layout', '황금 나선의 중심에',
    'GOLDEN RATIO: the face of PERSON A sits on the golden-spiral point, about 38 percent from the left and 38 percent from the top, with the curves and lines of the scene spiralling toward them. Frame from the head to the knees'),
  composition('diagonal', '대각선 구도', 'layout', '사선으로 역동적으로',
    'DIAGONAL COMPOSITION: strong diagonal lines in the scene (a ridge, path, railing or light beam) run from the bottom-left to the top-right corner, and PERSON A stands on that diagonal in the lower-left third for an energetic layout. The camera itself stays level'),
  composition('leading-lines', '리딩 라인', 'layout', '선들이 나를 가리키게',
    'LEADING LINES: lines in the scene (paths, rails, floor seams, rows of lights) converge from the edges of the frame toward PERSON A, who stands at the vanishing point in the center. Full body'),
  composition('negative-space', '여백 구도', 'layout', '넓은 빈 공간과 함께',
    'NEGATIVE SPACE: PERSON A is small in the lower-left part of the frame, about a quarter of the frame height, and most of the frame is calm, open space of the scene such as sky or a wall; minimal and elegant'),
  composition('frame-in-frame', '프레임 속 프레임', 'layout', '문·창·아치 안에',
    'FRAME WITHIN A FRAME: shoot through a natural frame of the scene in the foreground (an arch, doorway, window, porthole or cave opening) so it surrounds PERSON A, who stands inside it in the middle; the frame edges are slightly darker'),
  composition('foreground-framing', '전경 프레이밍', 'layout', '앞쪽 사물 사이로',
    'FOREGROUND FRAMING: soft out-of-focus objects of the scene (leaves, rocks, crystals or equipment) fill the very front corners of the frame, and PERSON A is sharp in the middle distance between them. Frame from the head to the knees'),
  composition('low-horizon', '낮은 지평선', 'layout', '하늘을 크게',
    'LOW HORIZON: the horizon sits in the bottom fifth of the frame and the sky (or ceiling) fills the rest; PERSON A stands full body on that low horizon line, small against the big sky'),
  // lens
  composition('wide-angle', '광각 렌즈', 'lens', '넓게, 원근감은 크게',
    'WIDE-ANGLE LENS (16 mm): the camera is close to PERSON A with a very wide field of view; strong perspective, lines stretch toward the edges and much of the scene is visible around them. Full body, with the face natural and undistorted in the center'),
  composition('fisheye', '어안 렌즈', 'lens', '볼록 렌즈처럼 둥글게',
    // The bulge is applied after generation; the model frames a centered, level shot with room around it.
    'FISHEYE (the lens bulge is added afterwards): frame PERSON A from the head to the knees exactly in the center with plenty of the scene around them; keep the camera level and straight'),
  composition('telephoto', '망원 압축', 'lens', '배경을 크게 끌어당기기',
    'TELEPHOTO COMPRESSION (200 mm from far away): the main landmark of the scene looks huge and close right behind PERSON A, depth is flattened and the background is gently soft. Frame from the head to the knees'),
  composition('bokeh', '아웃포커스', 'lens', '배경은 흐리게, 나만 또렷',
    'SHALLOW DEPTH OF FIELD (85 mm at f/1.4, focused on the eyes): PERSON A is tack sharp from the head to the waist, while everything behind them is strongly out of focus. Render the scene reference as a heavy, creamy blur where shapes are only soft color masses and every light or bright highlight becomes a large round bokeh ball; no sharp detail anywhere in the background'),
  composition('deep-focus', '팬포커스', 'lens', '앞부터 끝까지 모두 선명',
    'DEEP FOCUS (f/16): everything is sharp, from an object of the scene close to the lens, through PERSON A in the middle distance, to the far background. Full body'),
  composition('tilt-shift', '틸트시프트', 'lens', '장난감 미니어처처럼',
    'TILT-SHIFT MINIATURE: seen from a high vantage point at a distance, with only a thin horizontal band around PERSON A in focus and strong blur at the top and bottom, plus saturated colors, so the whole scene looks like a tiny toy model; PERSON A small but sharp'),
  composition('soft-focus', '소프트 포커스', 'lens', '몽글몽글 부드러운 빛',
    'SOFT FOCUS FILTER: a dreamy diffusion-filter look with glowing highlights and a gentle halo around bright areas, while the face of PERSON A stays recognizable. Frame from the head to the waist'),
  composition('starburst', '빛갈라짐', 'lens', '빛이 별처럼 갈라지게',
    'STARBURST (f/22): a bright light source of the scene (the sun, a lamp or a star) bursts into sharp star-shaped rays near an upper corner, while PERSON A stands in the foreground. Frame from the head to the knees'),
  // light and exposure
  composition('silhouette', '실루엣', 'light', '역광 속 검은 윤곽',
    'SILHOUETTE: shoot straight into a bright light behind PERSON A (a sunset, glowing portal or lit window) and expose for that light, so PERSON A becomes a crisp dark outline with a recognizable shape of the hair and pose. Full body'),
  composition('rim-light', '역광 림라이트', 'light', '윤곽이 빛나게',
    'BACKLIT RIM LIGHT: a strong light behind PERSON A draws a glowing rim around the hair, shoulders and arms, while a soft fill light keeps the face clearly visible. Frame from the head to the knees'),
  composition('golden-hour', '골든아워', 'light', '노을빛 따뜻하게',
    'GOLDEN HOUR: low, warm sunlight just before sunset (or the warmest light of the scene) comes from the side, with long soft shadows and a honey-colored glow on the skin. Frame from the head to the knees'),
  composition('blue-hour', '블루아워', 'light', '해 진 뒤 푸른 시간',
    'BLUE HOUR: just after sunset, deep blue ambient light covers the scene and warm lights glow, while a warm nearby light softly lights PERSON A; calm, cinematic mood. Frame from the head to the knees'),
  composition('high-key', '하이키', 'light', '밝고 화사하게',
    'HIGH-KEY: a bright, airy exposure with soft wrap-around light, minimal shadows and pale tones over the scene; cheerful and clean. Frame from the head to the waist'),
  composition('low-key', '로우키', 'light', '어둡고 극적으로',
    'LOW-KEY: a mostly dark frame with deep shadows where one focused light from the side picks PERSON A out of the darkness; dramatic and mysterious, with the face clearly lit. Frame from the head to the waist'),
  composition('rembrandt', '렘브란트 조명', 'light', '볼에 빛 삼각형',
    'REMBRANDT LIGHTING: one key light high and 45 degrees to the side lights the face of PERSON A and leaves a small triangle of light on the shadow-side cheek under the eye; painterly, with dark background tones. Close-up from the top of the head to the chest'),
  composition('long-exposure', '장노출', 'light', '빛이 흐르는 궤적',
    'LONG EXPOSURE (several seconds): moving lights in the scene become smooth glowing light trails (star trails, light painting, flowing water or vehicle lights) swirling around PERSON A, who stays perfectly still and sharp. Full body'),
  // shutter and special techniques
  composition('panning', '패닝', 'shutter', '배경이 흐르는 속도감',
    'PANNING: the camera tracks PERSON A moving sideways across the scene; PERSON A is the large, sharp main subject in the center, full body from head to feet, while the background is streaked with horizontal motion blur, giving a feeling of speed. Keep a clear gap of background between the arms and the body so the outline reads cleanly'),
  composition('freeze-motion', '고속 셔터', 'shutter', '순간을 멈춘 듯',
    'HIGH-SPEED SHUTTER (1/4000 s): an action moment frozen in mid-air, with hair and clothes caught in motion and droplets, dust or sparks of the scene frozen as crisp particles around PERSON A. Full body'),
  composition('reflection', '반사 구도', 'shutter', '물·거울에 비친 나',
    'REFLECTION: PERSON A and the scene are mirrored in a calm reflective surface (water, a polished floor or glass) in the lower part of the frame, and the waterline or floor line splits the frame into the real and the reflected halves. Full body'),
  composition('forced-perspective', '강제 원근법', 'shutter', '거인과 소인 착시',
    'FORCED PERSPECTIVE: a playful illusion of scale using distance; a giant landmark of the scene (a planet, the moon or a huge object) appears to rest on the open palm of PERSON A or be pinched between two fingers, lined up so it looks real. Full body'),
  composition('little-planet', '리틀 플래닛', 'shutter', '작은 행성 위에 선 나',
    'LITTLE PLANET (stereographic 360-degree panorama): the ground of the scene is bent into a complete small round globe, a sphere about 70 percent of the frame width in the lower half of the picture, with its curved horizon visible all the way around and the landmarks of the scene standing outward around its edge like on a tiny world. PERSON A stands upright on the very top of this little planet, full body, small but sharp and undistorted, and the sky fills the frame all around the globe'),
  composition('flat-lay', '플랫레이', 'shutter', '누워서 위에서 찍기',
    'FLAT LAY: PERSON A lies on their back on the ground of the scene with the head toward the top of the frame, photographed from straight above, arms in the pose, with textures and small items of the scene arranged around them; the face looks up into the camera'),
  composition('candid', '캔디드', 'shutter', '자연스러운 순간 포착',
    'CANDID SNAPSHOT: an unposed documentary moment, as if PERSON A had not noticed the camera, walking or looking at something in the scene with a natural expression, slightly off-center with a little foreground. Frame from the head to the knees'),
  composition('double-exposure', '이중 노출', 'shutter', '실루엣 속 풍경',
    'DOUBLE EXPOSURE: an artistic in-camera double exposure where the head-and-shoulders silhouette of PERSON A is filled with the landscape of the scene, the face still faintly recognizable, over a clean light background'),
];

const COMPOSITION_MAP = byId(COMPOSITIONS);
export const findComposition = (id?: string | null) => (id ? COMPOSITION_MAP.get(id) : undefined);
