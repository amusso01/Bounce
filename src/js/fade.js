// Fade up / fade down on scroll, ported from the FDRY theme (gsapFade.js).
// Add the attributes in Liquid; no JS changes are needed per section.
// Mounted with arrive, so sections the Theme Editor re-renders fade in again.
import 'arrive';
import gsap from 'gsap';

const DEFAULT_DISTANCE = 50;
const BASE_DURATION = 2;

// Pulls the viewport's bottom edge up by 10%, so a fade starts once the
// element's top passes 90% of the viewport height (ScrollTrigger's 'top 90%').
// No root: the browser clips by .page-wrapper on desktop, so this works with
// both of Horizon's scroll containers.
const ROOT_MARGIN = '0px 0px -10% 0px';

// Children of [data-fade-up-group] that fade up on their own
const GROUP_CHILDREN = 'p, h1, h2, h3, h4, h5, h6, ul, ol, img, figure, blockquote, hr';

const tweens = new Map();
const watched = new WeakSet();
let observer = null;

// key is the dataset prefix ('fadeUp' / 'fadeDown'); sign 1 starts below, -1 above.
// Paused, the tween still renders its start state straight away, so nothing
// flashes before the element is reached.
function fade(el, key, sign) {
	const data = el.dataset;
	const distance = parseFloat(data[`${key}Distance`]) || DEFAULT_DISTANCE;

	return gsap.fromTo(
		el,
		{ y: sign * distance, opacity: 0 },
		{
			y: 0,
			opacity: 1,
			// As on lionandmason: the attribute adds to the base, so ".2" is 2.2s
			duration: BASE_DURATION + (parseFloat(data[`${key}Duration`]) || 0),
			delay: parseFloat(data[`${key}Delay`]) || 0,
			ease: 'power3.out',
			// translate(0, 0) looks like no transform, but left inline it would
			// override hover transforms and trap position: fixed children.
			// Opacity stays inline at 1, or the CSS hide rule would cover it again.
			clearProps: 'transform',
			paused: true,
		},
	);
}

function watch(el, key, sign) {
	if (watched.has(el)) return;
	watched.add(el);

	tweens.set(el, fade(el, key, sign));
	observer.observe(el);
}

function prepareGroup(group) {
	const stagger = parseFloat(group.dataset.fadeUpGroup) || 0;

	Array.from(group.children)
		.filter((child) => child.matches(GROUP_CHILDREN) && !child.hasAttribute('data-fade-up'))
		.forEach((child, index) => {
			child.setAttribute('data-fade-up', '');

			if (stagger) {
				child.dataset.fadeUpDelay = (index * stagger).toFixed(2);
			}

			watch(child, 'fadeUp', 1);
		});
}

export function initFades() {
	const root = document.documentElement;

	// snippets/bounce-motion-gate.liquid sets this class from <head>, and removes
	// it on load if this never ran. Without it the content is already showing.
	if (!root.classList.contains('bounce-fade')) return;

	// Not ScrollTrigger: its stored positions can go stale, and an element left at
	// its start state is invisible. The browser checks the element's real box on
	// every scroll and reflow, whatever scrolls it.
	observer = new IntersectionObserver(
		(entries) => {
			entries.forEach((entry) => {
				// Already above the viewport counts too, e.g. after a reload lower down
				if (!entry.isIntersecting && entry.boundingClientRect.top > 0) return;

				observer.unobserve(entry.target);
				tweens.get(entry.target)?.play();
				tweens.delete(entry.target);
			});
		},
		{ rootMargin: ROOT_MARGIN },
	);

	// Groups first, so their children are tagged before the fade-up scan
	document.arrive('[data-fade-up-group]', { existing: true }, prepareGroup);
	document.arrive('[data-fade-up]', { existing: true }, (el) => watch(el, 'fadeUp', 1));
	document.arrive('[data-fade-down]', { existing: true }, (el) => watch(el, 'fadeDown', -1));

	document.addEventListener('shopify:section:unload', (event) => {
		tweens.forEach((tween, el) => {
			if (!event.target.contains(el)) return;
			observer.unobserve(el);
			tween.kill();
			tweens.delete(el);
		});
	});

	root.classList.add('bounce-fade-ready');
}
