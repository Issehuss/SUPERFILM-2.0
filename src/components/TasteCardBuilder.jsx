import React, { useState, useEffect } from 'react';
import TasteCard from './TasteCard';
import GlowColorPicker from './GlowColorPicker';
import { tasteCardQuestions } from '../constants/tasteCardQuestions';

const MAX_CARDS = 4;

const TasteCardBuilder = () => {
  // Load saved cards from localStorage (shared key with UserProfile)
  const [cards, setCards] = useState(() => {
    const saved = localStorage.getItem('tasteAnswers');
    const parsed = saved ? JSON.parse(saved) : [];

    // Filter out any broken or incomplete cards
    return parsed.filter(card =>
      card.question &&
      card.answer &&
      typeof card.glowClass === 'string'
    );
  });

  // Save to localStorage every time cards update
  useEffect(() => {
    localStorage.setItem('tasteAnswers', JSON.stringify(cards));
  }, [cards]);

  // Update a single field in a card (question, answer, or glow)
  const updateCard = (index, field, value) => {
    const updated = [...cards];
    updated[index] = {
      ...updated[index],
      [field]: value,
    };
    setCards(updated);
  };

  // Add a new blank card
  const addCard = () => {
    if (cards.length < MAX_CARDS) {
      setCards([
        ...cards,
        {
          question: tasteCardQuestions[0],
          answer: '',
          glowClass: 'shadow-[0_0_20px_2px_rgba(34,211,238,0.6)]',
        },
      ]);
    }
  };

  return (
    <div className="space-y-10">
      <h2 className="text-xl font-bold text-white text-center">Edit Your Taste Cards</h2>

      {cards.map((card, idx) => (
        <div key={idx} className="bg-zinc-900 p-4 rounded-xl shadow-md space-y-4">
          <h3 className="text-white font-semibold">Card {idx + 1}</h3>

          {/* Question Selector */}
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Choose a question:</label>
            <select
              value={card.question}
              onChange={(e) => updateCard(idx, 'question', e.target.value)}
              className="w-full p-2 bg-black text-white rounded border border-zinc-700"
            >
              {tasteCardQuestions.map((q, i) => (
                <option key={i} value={q}>{q}</option>
              ))}
            </select>
          </div>

          {/* Answer Input */}
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Your answer:</label>
            <input
              type="text"
              value={card.answer}
              onChange={(e) => updateCard(idx, 'answer', e.target.value)}
              placeholder="Write your answer..."
              className="w-full p-2 bg-black text-white rounded border border-zinc-700"
            />
          </div>

          {/* Glow Picker */}
          <GlowColorPicker
            selected={card.glowClass}
            onChange={(newGlow) => updateCard(idx, 'glowClass', newGlow)}
          />

          {/* Live Preview */}
          {card.question && card.answer.trim() !== '' ? (
            <div className="pt-2">
              <TasteCard
                question={card.question}
                answer={card.answer}
                glowClass={card.glowClass}
                index={idx}
                glowColor={glow?.color || '#FF0000'} 
              />
            </div>
          ) : (
            <p className="text-sm text-red-400 pt-2">This card needs a question and an answer to preview.</p>
          )}
        </div>
      ))}

      {/* Add Card Button */}
      {cards.length < MAX_CARDS && (
        <div className="text-center">
          <button
            onClick={addCard}
            className="bg-yellow-400 text-black px-4 py-2 rounded hover:bg-yellow-300 transition"
          >
            + Add Taste Card
          </button>
        </div>
      )}
    </div>
  );
};

export default TasteCardBuilder;

