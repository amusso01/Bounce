// Smooth wheel scrolling on Lenis, ported from the FDRY theme (smoothScroll.js).
// Lenis keeps native scrolling and only eases wheel and trackpad input, so sticky
// elements, Horizon's header and IntersectionObserver all keep working. Touch stays
// native (syncTouch is off).
import Lenis from 'lenis';
import gsap from 'gsap';

// easeOutExpo over a fixed 1.2s per wheel step, the same curve as
// lionandmason.com. With duration set, Lenis ignores lerp.
const SCROLL_DURATION = 1.2;
const easeOutExpo = (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t));

// Horizon's squeeze layout: from 990px `.page-wrapper` scrolls, not the window
// (assets/base.css, assets/scroll-container.js). Keep the width in sync with
// scroll-container.js; the bundle can't import @theme/* modules.
const SQUEEZE_QUERY = window.matchMedia('(min-width: 990px)');

let lenis = null;

/**
 * The running instance, or null where smooth scroll is off (Theme Editor,
 * reduced motion).
 */
export function getLenis() {
	return lenis;
}

const tick = (time) => lenis?.raf(time * 1000);

function create() {
	const pageWrapper = document.querySelector('.page-wrapper');
	const scroller =
		SQUEEZE_QUERY.matches && pageWrapper
			? {
					wrapper: pageWrapper,
					// With an element wrapper Lenis measures the wrapper's scrollHeight and
					// only watches content to know when to re-measure
					content: document.getElementById('MainContent') ?? pageWrapper,
				}
			: {};

	// Nested scroll areas (drawers, menus, predictive search) keep native scrolling
	lenis = new Lenis({
		...scroller,
		duration: SCROLL_DURATION,
		easing: easeOutExpo,
		allowNestedScroll: true,
	});

	syncScrollLock();
}

// overflow: hidden does not stop Lenis, since it scrolls with scrollTo(). Horizon's
// lockScroll() marks <html> with [scroll-lock] for every dialog and drawer, so
// follow that one attribute.
function syncScrollLock() {
	if (document.documentElement.hasAttribute('scroll-lock')) {
		lenis?.stop();
	} else {
		lenis?.start();
	}
}

function headerOffset() {
	const header = document.getElementById('header-component');
	return header?.getAttribute('sticky') ? header.offsetHeight : 0;
}

/**
 * Same-page hash links glide to their target below the sticky header instead of
 * jumping. Anything this does not handle falls through to the browser.
 */
function initAnchors() {
	document.addEventListener('click', (event) => {
		if (event.defaultPrevented || event.button !== 0) return;
		if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
		if (!(event.target instanceof Element)) return;

		const link = event.target.closest('a[href*="#"]');

		// The skip link keeps the native jump, which also moves focus
		if (!link || link.target === '_blank' || link.classList.contains('skip-to-content-link')) return;
		if (link.hash.length < 2 || link.href.split('#')[0] !== location.href.split('#')[0]) return;

		// A stopped Lenis ignores scrollTo, e.g. while a drawer holds the page
		if (!lenis || lenis.isStopped) return;

		const target = document.getElementById(decodeURIComponent(link.hash.slice(1)));

		if (!target) return;

		event.preventDefault();

		lenis.scrollTo(target, { offset: -headerOffset() });
		history.pushState(null, '', link.hash);

		// Move focus with the scroll, as a native jump would, so the next Tab
		// carries on from the target
		if (!target.matches('a[href], button, input, select, textarea, [tabindex]')) {
			target.setAttribute('tabindex', '-1');
		}

		target.focus({ preventScroll: true });
	});
}

export function initSmoothScroll() {
	// The editor keeps native scrolling, so its jump to a selected section isn't fought
	if (window.Shopify?.designMode) return;
	if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

	create();

	// One clock: Lenis steps on GSAP's ticker, so any GSAP scroll effect added
	// later reads the smoothed position in the same frame
	gsap.ticker.add(tick);
	gsap.ticker.lagSmoothing(0);

	// The scroll container changes at 990px, so rebuild Lenis on the new one
	SQUEEZE_QUERY.addEventListener('change', () => {
		lenis?.destroy();
		create();
	});

	new MutationObserver(syncScrollLock).observe(document.documentElement, {
		attributes: true,
		attributeFilter: ['scroll-lock'],
	});

	initAnchors();
}
