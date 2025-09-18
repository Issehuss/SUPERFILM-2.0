// src/components/polls/PollComposer.jsx
import { useState } from "react";
import supabase from "../../supabaseClient";

export default function PollComposer({ clubId, onClose, onCreated }) {
  const [question, setQuestion] = useState("");
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [options, setOptions] = useState(["", ""]);
  const [saving, setSaving] = useState(false);

  const cleanedOptions = options.map(o => o.trim()).filter(Boolean);
  const hasTwoOrMore = cleanedOptions.length >= 2;
  const hasDuplicate = new Set(cleanedOptions.map(o => o.toLowerCase())).size !== cleanedOptions.length;
  const canSave = question.trim().length > 0 && hasTwoOrMore && !hasDuplicate;

  const updateOption = (i, val) =>
    setOptions(prev => prev.map((o, idx) => (idx === i ? val : o)));

  const addOption = () => {
    if (options.length >= 12) return;
    setOptions(prev => [...prev, ""]);
  };

  const removeOption = (i) => {
    if (options.length <= 2) return; // keep at least two inputs visible
    setOptions(prev => prev.filter((_, idx) => idx !== i));
  };

  const create = async () => {
    if (!clubId) {
      alert("Missing club ID. Please close and try again.");
      return;
    }
    if (!canSave || saving) return;

    setSaving(true);
    try {
      const { data: pollId, error } = await supabase.rpc("create_poll", {
        p_club_id: clubId,
        p_question: question.trim(),
        p_allow_multiple: allowMultiple,
        p_options: cleanedOptions,
      });
      if (error) throw error;

      // Let parent insert the chat message (with optimistic UI)
      onCreated?.(pollId, question.trim());
      // optional reset if the modal stays open in future
      setQuestion("");
      setOptions(["", ""]);
      setAllowMultiple(false);
    } catch (e) {
      alert(e.message || "Couldn’t create poll.");
    } finally {
      setSaving(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      create();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center">
      <div className="w-full max-w-lg rounded-2xl bg-zinc-900 text-zinc-100 p-5 border border-zinc-800 shadow-2xl">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-semibold">Create a poll</h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200"
            aria-label="Close"
          >
            Close
          </button>
        </div>

        <label className="block text-sm mb-1">Question</label>
        <input
          className="w-full bg-zinc-800 rounded-xl p-3 mb-3 outline-none focus:ring-2 ring-yellow-400/80"
          placeholder="What should we watch next?"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={onKeyDown}
        />

        <div className="flex items-center gap-2 mb-3">
          <input
            id="allowMulti"
            type="checkbox"
            checked={allowMultiple}
            onChange={(e) => setAllowMultiple(e.target.checked)}
          />
          <label htmlFor="allowMulti" className="text-sm">
            Allow multiple answers
          </label>
        </div>

        <div className="space-y-2 mb-2">
          {options.map((opt, i) => (
            <div key={i} className="flex gap-2">
              <input
                className="flex-1 bg-zinc-800 rounded-xl p-3 outline-none focus:ring-2 ring-yellow-400/80"
                placeholder={`Option ${i + 1}`}
                value={opt}
                onChange={(e) => updateOption(i, e.target.value)}
                onKeyDown={onKeyDown}
              />
              {options.length > 2 && (
                <button
                  type="button"
                  onClick={() => removeOption(i)}
                  className="px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-sm"
                  title="Remove option"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between text-xs mb-3">
          <div className="text-zinc-400">
            {options.length}/12 options
            {hasDuplicate && <span className="text-red-400 ml-2">Duplicate options not allowed</span>}
          </div>
          {options.length < 12 && (
            <button
              type="button"
              onClick={addOption}
              className="underline underline-offset-4 text-yellow-300 hover:text-yellow-200"
            >
              Add option
            </button>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700"
          >
            Cancel
          </button>
          <button
            onClick={create}
            disabled={!canSave || saving}
            className="px-4 py-2 rounded-xl bg-yellow-400 text-black font-medium disabled:opacity-50"
          >
            {saving ? "Creating…" : "Create poll"}
          </button>
        </div>
      </div>
    </div>
  );
}
