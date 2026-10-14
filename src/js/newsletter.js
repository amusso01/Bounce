// Bounce newsletter (sections/bounce-newsletter.liquid).
// Posts Shopify's customer form in the background and swaps the thank-you view in, with no
// reload. Shopify answers the post with a redirect back to this page, re-rendered with the
// form's state, so the section is read from that HTML: the thank-you view means success,
// the error message means Shopify refused the email.
// Anything else falls back to the browser's own submit, and the reloaded page shows the same
// views. One delegated listener, so sections the Theme Editor re-renders need no mounting.

const ROOT = 'data-bounce-newsletter';

function setBusy(button, busy) {
	if (!button) return;
	button.disabled = busy;
	button.toggleAttribute('aria-busy', busy);
}

// The form gives way to the view kept in the <template>. Inserted as new nodes, so fade.js
// (through arrive) fades it in. Focus goes to its title so screen readers announce it.
function showSuccess(root, form) {
	const template = root.querySelector('template[data-bounce-newsletter-success]');
	if (!template) return false;

	form.replaceWith(template.content.cloneNode(true));
	template.remove();
	root.querySelector('[data-bounce-newsletter-focus]')?.focus({ preventScroll: true });
	return true;
}

// Only the message is copied over: re-rendering the form would fade it in again and lose
// what was typed
function showError(form, freshForm) {
	const message = freshForm.querySelector('[data-bounce-newsletter-error]');
	const field = form.querySelector('.bounce-newsletter__field');
	const input = form.elements['contact[email]'];
	if (!message || !field || !input) return false;

	form.querySelector('[data-bounce-newsletter-error]')?.remove();
	field.before(document.importNode(message, true));
	input.setAttribute('aria-invalid', 'true');
	input.setAttribute('aria-describedby', message.id);
	input.focus();
	return true;
}

async function onSubmit(event) {
	const form = event.target;
	const root = form.closest?.(`[${ROOT}]`);
	// Shopify's bot protection, or anything else that took over the submit, goes first
	if (!root || event.defaultPrevented) return;

	event.preventDefault();

	// Disabled, it also blocks submitting again with Enter while this one is out
	const button = form.querySelector('[type="submit"]');
	setBusy(button, true);

	// 'success' or 'error' once a view is shown; anything else falls back to the browser
	let shown = null;

	try {
		const response = await fetch(form.action, {
			method: 'POST',
			// Urlencoded, like the browser's own submit
			body: new URLSearchParams(new FormData(form)),
		});

		// Shopify sends some posts to a captcha page. The browser goes there, and comes back
		// to this page with the thank-you view.
		if (response.ok && !new URL(response.url).pathname.includes('/challenge')) {
			const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
			const fresh = doc.querySelector(`[${ROOT}="${CSS.escape(root.getAttribute(ROOT))}"]`);

			// Template content isn't part of the parsed tree, so a success view there is the real one
			if (fresh?.querySelector('.bounce-newsletter__success')) {
				if (showSuccess(root, form)) shown = 'success';
			} else if (fresh?.querySelector('form')) {
				if (showError(form, fresh.querySelector('form'))) shown = 'error';
			}
		}
	} catch {
		// Network error: the browser's submit below tries again
	}

	// The form, and its button, are gone
	if (shown === 'success') return;

	setBusy(button, false);

	// Doesn't fire the submit event, so this listener doesn't catch it again
	if (!shown) form.submit();
}

export function initNewsletters() {
	document.addEventListener('submit', onSubmit);
}
