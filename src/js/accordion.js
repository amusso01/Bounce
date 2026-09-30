// Bounce accordion (sections/bounce-accordion.liquid) on AccordionJS.
// Mounted with arrive, so sections the Theme Editor re-renders mount again on their own.
import 'arrive';
import Accordion from 'accordion-js';

const SELECTOR = '[data-bounce-accordion]';

function mount(el) {
	if (el.bounceAccordion) return;

	const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	el.bounceAccordion = new Accordion(el, {
		// Several answers can be open at once; all start closed
		showMultiple: true,
		duration: reduceMotion ? 0 : 300,
	});
}

export function initAccordions() {
	document.arrive(SELECTOR, { existing: true }, mount);

	document.addEventListener('shopify:section:unload', (event) => {
		event.target.querySelectorAll(SELECTOR).forEach((el) => {
			el.bounceAccordion?.destroy();
			delete el.bounceAccordion;
		});
	});

	// Theme Editor: selecting a Question block opens it
	document.addEventListener('shopify:block:select', (event) => {
		const el = event.target.closest(SELECTOR);
		if (!el?.bounceAccordion) return;
		el.bounceAccordion.open([...el.children].indexOf(event.target));
	});
}
