import React, { useState } from 'react';
import { X } from 'lucide-react';

// Replace with your actual WhatsApp business number (international format, no + or spaces)
const WHATSAPP_NUMBER = '918483048363';
const PRE_FILLED_MESSAGE = 'Hi! I want to know more about Crunch Fitness memberships and offers.';

const WhatsAppButton: React.FC = () => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const handleClick = () => {
    const encodedMessage = encodeURIComponent(PRE_FILLED_MESSAGE);
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodedMessage}`, '_blank');
  };

  return (
    <div className="fixed bottom-24 right-6 z-40 flex flex-col items-end gap-2">
      {/* Tooltip bubble */}
      {showTooltip && !dismissed && (
        <div className="flex items-start gap-1 bg-white text-gray-800 text-sm rounded-2xl rounded-br-sm shadow-lg px-4 py-3 max-w-[200px] animate-fade-in">
          <span>Chat with us on WhatsApp! 💬</span>
          <button
            onClick={(e) => { e.stopPropagation(); setDismissed(true); }}
            className="ml-1 text-gray-400 hover:text-gray-600 flex-shrink-0 mt-0.5"
            aria-label="Dismiss"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* WhatsApp button */}
      <button
        onClick={handleClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        aria-label="Chat on WhatsApp"
        className="group relative w-14 h-14 bg-[#25D366] hover:bg-[#20ba5a] rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 flex items-center justify-center"
      >
        {/* Pulse ring */}
        <span className="absolute inset-0 rounded-full bg-[#25D366] opacity-40 animate-ping" />

        {/* WhatsApp SVG icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 32 32"
          className="w-7 h-7 fill-white relative z-10"
        >
          <path d="M16.003 2C8.28 2 2 8.28 2 16.003c0 2.478.654 4.845 1.797 6.9L2 30l7.283-1.77A13.944 13.944 0 0016.003 30C23.72 30 30 23.72 30 16.003 30 8.28 23.72 2 16.003 2zm0 25.524a11.51 11.51 0 01-5.908-1.626l-.424-.253-4.324 1.05 1.082-4.198-.277-.432A11.47 11.47 0 014.476 16c0-6.355 5.172-11.524 11.527-11.524S27.527 9.645 27.527 16c0 6.354-5.172 11.524-11.524 11.524zm6.32-8.631c-.346-.173-2.048-1.01-2.366-1.127-.317-.115-.548-.173-.779.173-.23.346-.892 1.127-1.094 1.358-.201.23-.403.26-.749.087-.346-.173-1.46-.538-2.781-1.716-1.028-.917-1.722-2.05-1.924-2.396-.202-.346-.021-.533.152-.705.156-.154.346-.403.519-.605.173-.202.23-.346.346-.577.115-.23.058-.432-.029-.605-.087-.173-.779-1.878-1.068-2.57-.28-.674-.565-.583-.779-.594l-.663-.011c-.23 0-.605.086-.923.432-.317.346-1.21 1.183-1.21 2.885s1.239 3.346 1.41 3.577c.173.23 2.44 3.72 5.912 5.216.826.357 1.47.57 1.972.729.829.264 1.583.226 2.179.137.665-.1 2.048-.837 2.337-1.645.289-.807.289-1.499.202-1.645-.086-.144-.317-.23-.663-.403z" />
        </svg>
      </button>
    </div>
  );
};

export default WhatsAppButton;
