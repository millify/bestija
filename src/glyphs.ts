/**
 * Writing systems used by the intro decode. Each pool is filtered against the
 * page's own font stack at runtime, so a system that can't render a script is
 * dropped rather than painting tofu boxes.
 */

const POOLS: Array<[name: string, chars: string]> = [
	['han', '食味香茶酒魚海鮮菜園客宴家風月光山川花草木火水土金石竹雨雪春夏秋冬'],
	[
		'hiragana',
		'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわん',
	],
	['hangul', '가나다라마바사아자차카타파하거너더러머버서어저처커터퍼허고노도로모보소오조'],
	['devanagari', 'अआइईउऊएऐओऔकखगघङचछजझञटठडढणतथदधनपफबभमयरलवशषसह'],
	['thai', 'กขคฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรลวศษสหฬอฮ'],
	['arabic', 'ابتثجحخدذرزسشصضطظعغفقكلمنهوي'],
	['hebrew', 'אבגדהוזחטיכלמנסעפצקרשת'],
	['greek', 'ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩαβγδεζηθικλμνξοπρστυφχψω'],
	['cyrillic', 'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ'],
	['georgian', 'აბგდევზთიკლმნოპჟრსტუფქღყშჩცძწჭხჯჰ'],
	['armenian', 'ԱԲԳԴԵԶԷԸԹԺԻԼԽԾԿՀՁՂՃՄՅՆՇՈՉՊՋՌՍՎՏՐՑՒՓՔՕՖ'],
	['tamil', 'அஆஇஈஉஊஎஏஐஒஓகஙசஞடணதநபமயரலவழளறன'],
	['bengali', 'অআইঈউঊএঐওঔকখগঘঙচছজঝটঠডঢণতথদধনপফবভমযরলশষসহ'],
	['ethiopic', 'ሀለሐመሠረሰቀበተኀነአከወዐዘየደገጠጰጸፀፈፐ'],
	[
		'katakana',
		'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワン',
	],
]

/** Private-use codepoint: no font has a real glyph for it. */
const MISSING = '\uE000'
const PROBE_SIZE = 40
const MIN_USABLE = 8

export interface WorldScript {
	name: string
	chars: string[]
	/** Mean advance width at 1em, in the measured font stack. */
	em: number
}

export function buildScripts(fontFamily: string): WorldScript[] {
	const ctx = document.createElement('canvas').getContext('2d')
	if (!ctx) return []

	ctx.font = `${PROBE_SIZE}px ${fontFamily}`
	const tofu = ctx.measureText(MISSING).width

	const scripts: WorldScript[] = []
	for (const [name, chars] of POOLS) {
		let total = 0
		const usable: string[] = []

		for (const char of chars) {
			const width = ctx.measureText(char).width
			if (width < 0.5 || Math.abs(width - tofu) < 0.5) continue
			usable.push(char)
			total += width
		}

		if (usable.length < MIN_USABLE) continue
		scripts.push({ name, chars: usable, em: total / usable.length / PROBE_SIZE })
	}
	return scripts
}
