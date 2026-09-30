// Bounce carousel (sections/bounce-carousel.liquid) on Swiper.
// Mounted with arrive, so sections the Theme Editor re-renders mount again on their own.
import 'arrive';
import Swiper from 'swiper';
import { A11y, Autoplay, Keyboard, Navigation } from 'swiper/modules';

const SELECTOR = '[data-bounce-carousel]';

function mount(root) {
	const el = root.querySelector('.swiper');
	if (!el || el.swiper) return; // Swiper stores its instance on the element

	const { gap, autoplay, labelPrev, labelNext, labelSlide } = root.dataset;
	const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	new Swiper(el, {
		modules: [A11y, Autoplay, Keyboard, Navigation],
		// Cards per view at Horizon's breakpoints (src/scss/base/_media.scss): a peek of the
		// next card on phones, 2 from 750px, 3 from 990px
		slidesPerView: 1.2,
		breakpoints: {
			750: { slidesPerView: 2 },
			990: { slidesPerView: 3 },
		},
		spaceBetween: Number(gap) || 0,
		// Next on the last card goes back to the first (and the other way round)
		rewind: true,
		navigation: {
			prevEl: root.querySelector('.bounce-carousel__arrow--prev'),
			nextEl: root.querySelector('.bounce-carousel__arrow--next'),
		},
		keyboard: { enabled: true, onlyInViewport: true },
		a11y: {
			prevSlideMessage: labelPrev,
			nextSlideMessage: labelNext,
			slideLabelMessage: labelSlide,
		},
		// Off unless the section turns it on, and never for viewers who asked for less motion
		autoplay:
			autoplay && !reduceMotion
				? { delay: Number(autoplay), pauseOnMouseEnter: true, disableOnInteraction: false }
				: false,
	});
}

function swiperFor(target) {
	return target?.closest(SELECTOR)?.querySelector('.swiper')?.swiper;
}

export function initCarousels() {
	document.arrive(SELECTOR, { existing: true }, mount);

	document.addEventListener('shopify:section:unload', (event) => {
		event.target.querySelectorAll(`${SELECTOR} .swiper`).forEach((el) => el.swiper?.destroy());
	});

	// Theme Editor: selecting a slide block shows that slide
	document.addEventListener('shopify:block:select', (event) => {
		const swiper = swiperFor(event.target);
		if (!swiper) return;
		swiper.autoplay?.stop();
		swiper.slideTo(swiper.slides.indexOf(event.target.closest('.swiper-slide')));
	});

	document.addEventListener('shopify:block:deselect', (event) => {
		const swiper = swiperFor(event.target);
		if (swiper?.params.autoplay?.enabled) swiper.autoplay.start();
	});
}
