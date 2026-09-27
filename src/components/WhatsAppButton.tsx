import React from 'react';
import { whatsappLink } from '@/lib/site';

const PRE_FILLED_MESSAGE = 'Hi! I want to know more about Crunch Fitness memberships and offers.';

/** Floating WhatsApp shortcut — stacked above the chat assistant button. */
const WhatsAppButton: React.FC = () => (
  <a
    href={whatsappLink(PRE_FILLED_MESSAGE)}
    target="_blank"
    rel="noopener noreferrer"
    aria-label="Chat with us on WhatsApp (opens in a new tab)"
    className="group fixed bottom-[4.75rem] right-5 z-40 flex items-center sm:bottom-[6.25rem] sm:right-7"
  >
    <span className="pointer-events-none mr-3 hidden whitespace-nowrap rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-ink-950 opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100 md:block">
      Chat on WhatsApp
    </span>
    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#25D366] shadow-[0_10px_30px_-8px_rgba(0,0,0,0.6)] transition-transform duration-200 group-hover:scale-105 group-active:scale-95 sm:h-14 sm:w-14">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" className="h-6 w-6 fill-white sm:h-7 sm:w-7" aria-hidden>
        <path d="M16.003 2C8.28 2 2 8.28 2 16.003c0 2.478.654 4.845 1.797 6.9L2 30l7.283-1.77A13.944 13.944 0 0016.003 30C23.72 30 30 23.72 30 16.003 30 8.28 23.72 2 16.003 2zm0 25.524a11.51 11.51 0 01-5.908-1.626l-.424-.253-4.324 1.05 1.082-4.198-.277-.432A11.47 11.47 0 014.476 16c0-6.355 5.172-11.524 11.527-11.524S27.527 9.645 27.527 16c0 6.354-5.172 11.524-11.524 11.524zm6.32-8.631c-.346-.173-2.048-1.01-2.366-1.127-.317-.115-.548-.173-.779.173-.23.346-.892 1.127-1.094 1.358-.201.23-.403.26-.749.087-.346-.173-1.46-.538-2.781-1.716-1.028-.917-1.722-2.05-1.924-2.396-.202-.346-.021-.533.152-.705.156-.154.346-.403.519-.605.173-.202.23-.346.346-.577.115-.23.058-.432-.029-.605-.087-.173-.779-1.878-1.068-2.57-.28-.674-.565-.583-.779-.594l-.663-.011c-.23 0-.605.086-.923.432-.317.346-1.21 1.183-1.21 2.885s1.239 3.346 1.41 3.577c.173.23 2.44 3.72 5.912 5.216.826.357 1.47.57 1.972.729.829.264 1.583.226 2.179.137.665-.1 2.048-.837 2.337-1.645.289-.807.289-1.499.202-1.645-.086-.144-.317-.23-.663-.403z" />
      </svg>
    </span>
  </a>
);

export default WhatsAppButton;
