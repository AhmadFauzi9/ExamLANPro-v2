/**
 * ExamLAN Pro - Universal Tooltip System Hook
 */

let tooltipEl = null;
let currentTarget = null;
let hideTimer = null;

function getOrCreateTooltip() {
    if (!tooltipEl) {
        tooltipEl = document.getElementById('app-global-tooltip');
        if (!tooltipEl) {
            tooltipEl = document.createElement('div');
            tooltipEl.id = 'app-global-tooltip';
            document.body.appendChild(tooltipEl);
        }
    }
    return tooltipEl;
}

function sanitizeElement(el) {
    if (!el || !(el instanceof Element)) return;
    if (el.hasAttribute('title')) {
        const val = el.getAttribute('title');
        if (val && val.trim()) {
            el.setAttribute('data-tooltip', val.trim());
        }
        el.removeAttribute('title');
    }
    if (el.hasAttribute('alt')) {
        const altVal = el.getAttribute('alt');
        if (altVal && altVal.trim() && !el.getAttribute('data-tooltip')) {
            el.setAttribute('data-tooltip', altVal.trim());
        }
    }
}

function showTooltipFor(target) {
    const text = target.getAttribute('data-tooltip');
    if (!text || !text.trim()) return;

    const tip = getOrCreateTooltip();
    tip.textContent = text.trim();
    tip.style.display = 'block';

    const rect = target.getBoundingClientRect();
    const tipRect = tip.getBoundingClientRect();

    let top = rect.top - tipRect.height - 7;
    let left = rect.left + (rect.width / 2) - (tipRect.width / 2);
    let placement = 'top';

    if (top < 8) {
        top = rect.bottom + 7;
        placement = 'bottom';
    }

    const minLeft = 8;
    const maxLeft = window.innerWidth - tipRect.width - 8;
    left = Math.max(minLeft, Math.min(left, maxLeft));

    const arrowOffset = (rect.left + (rect.width / 2)) - left;
    tip.style.setProperty('--arrow-left', `${arrowOffset}px`);

    tip.style.top = `${Math.round(top)}px`;
    tip.style.left = `${Math.round(left)}px`;
    tip.className = `active ${placement === 'top' ? 'arrow-bottom' : 'arrow-top'}`;
}

function hideTooltip() {
    if (!tooltipEl) return;
    tooltipEl.classList.remove('active');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
        if (tooltipEl && !tooltipEl.classList.contains('active')) {
            tooltipEl.style.display = 'none';
        }
    }, 120);
    currentTarget = null;
}

export function initGlobalTooltipSystem() {
    document.addEventListener('mouseover', (e) => {
        let el = e.target;
        while (el && el !== document.body && el !== document.documentElement) {
            if (el.hasAttribute('title') || el.hasAttribute('alt')) {
                sanitizeElement(el);
            }
            if (el.hasAttribute('data-tooltip')) {
                currentTarget = el;
                clearTimeout(hideTimer);
                showTooltipFor(el);
                return;
            }
            el = el.parentElement;
        }
    }, true);

    document.addEventListener('mouseout', (e) => {
        if (!currentTarget) return;
        if (e.relatedTarget && currentTarget.contains(e.relatedTarget)) return;
        hideTooltip();
    }, true);

    document.addEventListener('click', () => {
        hideTooltip();
    }, true);

    window.addEventListener('scroll', () => {
        hideTooltip();
    }, true);

    const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
            if (m.type === 'attributes' && m.attributeName === 'title') {
                sanitizeElement(m.target);
            } else if (m.type === 'childList') {
                m.addedNodes.forEach(node => {
                    if (node instanceof Element) {
                        if (node.hasAttribute('title') || node.hasAttribute('alt')) sanitizeElement(node);
                        if (node.querySelectorAll) {
                            node.querySelectorAll('[title], [alt]').forEach(sanitizeElement);
                        }
                    }
                });
            }
        }
    });

    observer.observe(document.documentElement, {
        subtree: true,
        attributes: true,
        childList: true,
        attributeFilter: ['title']
    });
    document.querySelectorAll('[title], [alt]').forEach(sanitizeElement);
}
