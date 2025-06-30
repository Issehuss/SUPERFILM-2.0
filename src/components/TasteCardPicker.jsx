import React from 'react';
import { questionList } from '../constants/tasteQuestions';
import { glowOptions } from '../constants/glowOptions';

const TasteCardPicker = ({ selected, setSelected, useGlowStyle, setUseGlowStyle }) => {
  const handleSelect = (question) => {
    const isAlreadySelected = selected.find((card) => card.question === question);

    if (isAlreadySelected) {
      setSelected(selected.filter((card) => card.question !== question));
    } else if (selected.length < 4) {
      setSelected([
        ...selected,
        {
          question,
          answer: '',
          glowClass: glowOptions.free[1]?.class || '', // default to Cyan
        },
      ]);
    }
  };

  const handleAnswerChange = (question, newAnswer) => {
    setSelected(
      selected.map((card) =>
        card.question === question
          ? { ...card, answer: newAnswer }
          : card
      )
    );
  };

  const cycleGlow = (question, direction) => {
    setSelected(
      selected.map((card) => {
        if (card.question !== question) return card;

        const currentIndex = glowOptions.free.findIndex(g => g.class === card.glowClass);
        const newIndex = (currentIndex + direction + glowOptions.free.length) % glowOptions.free.length;
        return { ...card, glowClass: glowOptions.free[newIndex].class };
      })
    );
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-10">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-white">Pick up to 4 Taste Questions</h2>
        <label className="flex items-center space-x-2 text-sm text-gray-300">
          <input
            type="checkbox"
            checked={useGlowStyle}
            onChange={() => setUseGlowStyle(!useGlowStyle)}
          />
          <span>Use Glow Style</span>
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {questionList.map((question, index) => {
          const selectedCard = selected.find((card) => card.question === question);
          const isSelected = !!selectedCard;

          const glow = glowOptions.free.find(g => g.class === selectedCard?.glowClass);

          const style = useGlowStyle
            ? { boxShadow: glow?.glow || 'none' }
            : { border: glow?.border || '3px solid #FF0000' };

          return (
            <div
              key={index}
              onClick={() => handleSelect(question)}
              className={`
                relative rounded-xl p-4 text-white flex flex-col justify-between cursor-pointer
                transition-all duration-300 ease-in-out h-56
                bg-zinc-800 hover:bg-zinc-700
              `}
              style={isSelected ? style : { border: '1px solid #444' }}
            >
              <div className="text-sm font-medium text-center pointer-events-none">
                {question}
              </div>

              {isSelected && (
                <>
                  <input
                    type="text"
                    placeholder="Your answer..."
                    value={selectedCard.answer}
                    onChange={(e) => handleAnswerChange(question, e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-3 px-2 py-1 text-sm text-black rounded bg-white w-full"
                  />

                  {/* Glow Carousel */}
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center justify-between mt-4"
                  >
                    <button
                      onClick={() => cycleGlow(question, -1)}
                      className="text-white text-lg px-2"
                      aria-label="Previous glow"
                    >
                      ←
                    </button>

                    <div className="text-xs text-center flex-1 text-zinc-300">
                      {glowOptions.free.find(g => g.class === selectedCard.glowClass)?.name || 'None'}
                    </div>

                    <button
                      onClick={() => cycleGlow(question, 1)}
                      className="text-white text-lg px-2"
                      aria-label="Next glow"
                    >
                      →
                    </button>
                  </div>
                </>
              )}

              <div
                className={`absolute top-2 right-2 w-4 h-4 border border-white rounded-sm ${
                  isSelected ? 'bg-cyan-400' : 'bg-transparent'
                }`}
              ></div>
            </div>
          );
        })}
      </div>

      <p className="text-zinc-400 text-xs mt-6 text-center">
        Click a card to select or unselect. Answer the question, and use ← → to change glow style.
      </p>
    </div>
  );
};

export default TasteCardPicker;







