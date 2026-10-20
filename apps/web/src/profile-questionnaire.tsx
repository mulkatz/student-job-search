import { useState } from "react";
import type { ProfileFact } from "../../../packages/server/dist/profile-schema.js";

type FactInput = Pick<ProfileFact, "id" | "category" | "value">;
const preferences = [
  "working_language",
  "employment_preference",
  "location_preference",
  "weekly_availability_hours",
  "work_authorization",
];

export function ProfileQuestionnaire({
  busy,
  facts,
  onSave,
}: {
  busy: boolean;
  facts: FactInput[];
  onSave: (facts: FactInput[]) => Promise<void>;
}) {
  const [languages, setLanguages] = useState([
    { id: crypto.randomUUID(), name: "", level: "" },
  ]);
  const [hours, setHours] = useState("");
  const [employment, setEmployment] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [authorization, setAuthorization] = useState("");
  const [skills, setSkills] = useState("");
  const [experience, setExperience] = useState("");
  const [search, setSearch] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const toggle = (values: string[], value: string) =>
    values.includes(value)
      ? values.filter((item) => item !== value)
      : [...values, value];
  const save = async () => {
    setError("");
    if (
      hours &&
      (!Number.isFinite(Number(hours)) ||
        Number(hours) < 0 ||
        Number(hours) > 168)
    ) {
      setError(
        "Available weekly hours must be between 0 and 168, or left blank.",
      );
      return;
    }
    const next = facts.filter(
      (fact) =>
        !preferences.includes(fact.category) &&
        !fact.id.startsWith("questionnaire_"),
    );
    const add = (category: ProfileFact["category"], value: string) => {
      if (value.trim())
        next.push({
          id: `questionnaire_${category}_${next.length}`,
          category,
          value: value.trim(),
        });
    };
    for (const language of languages)
      if (language.name.trim())
        add(
          "working_language",
          `${language.name.trim()}${language.level ? ` ${language.level}` : ""}`,
        );
    add("weekly_availability_hours", hours);
    for (const value of employment) add("employment_preference", value);
    for (const value of locations) add("location_preference", value);
    add("work_authorization", authorization);
    for (const value of skills.split("\n")) add("skill", value);
    add("other", experience ? `Previous experience: ${experience}` : "");
    add("search_preference", search);
    if (
      next.length === 0 ||
      next.length > 20 ||
      next.some((fact) => fact.value.length > 300)
    ) {
      setError(
        "Keep 1–20 facts, each up to 300 characters. Remove unnecessary extracted facts or shorten your answers.",
      );
      return;
    }
    await onSave(next);
  };
  return (
    <section className="questionnaire" aria-labelledby="questionnaire-title">
      <h3 id="questionnaire-title">2. Confirm your search profile</h3>
      <p>
        Only enter facts you can confirm. Blank answers stay unknown. These
        answers replace extracted language, availability, employment, workplace
        and authorization preferences; document skills and other facts remain
        for review.
      </p>
      <fieldset disabled={busy}>
        <legend>Working languages</legend>
        {languages.map((language) => (
          <div className="questionnaire-language" key={language.id}>
            <label>
              Language
              <input
                maxLength={80}
                placeholder="For example, English"
                value={language.name}
                onChange={(event) =>
                  setLanguages(
                    languages.map((item) =>
                      item.id === language.id
                        ? { ...item, name: event.target.value }
                        : item,
                    ),
                  )
                }
              />
            </label>
            <label>
              Level
              <select
                value={language.level}
                onChange={(event) =>
                  setLanguages(
                    languages.map((item) =>
                      item.id === language.id
                        ? { ...item, level: event.target.value }
                        : item,
                    ),
                  )
                }
              >
                <option value="">Unknown / not specified</option>
                {[
                  "A1",
                  "A2",
                  "B1",
                  "B2",
                  "C1",
                  "C2",
                  "fluent",
                  "not spoken",
                ].map((level) => (
                  <option key={level}>{level}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="secondary"
              disabled={languages.length === 1}
              onClick={() =>
                setLanguages(
                  languages.filter((item) => item.id !== language.id),
                )
              }
            >
              Remove language
            </button>
          </div>
        ))}
        <button
          type="button"
          className="secondary"
          disabled={languages.length >= 5}
          onClick={() =>
            setLanguages([
              ...languages,
              { id: crypto.randomUUID(), name: "", level: "" },
            ])
          }
        >
          Add language
        </button>
      </fieldset>
      <div className="questionnaire-grid">
        <label>
          Available hours per week
          <input
            type="number"
            min="0"
            max="168"
            step="0.5"
            value={hours}
            onChange={(event) => setHours(event.target.value)}
            disabled={busy}
            placeholder="Unknown"
          />
        </label>
        <label>
          Employee work permission in Germany
          <select
            value={authorization}
            onChange={(event) => setAuthorization(event.target.value)}
            disabled={busy}
          >
            <option value="">Unknown / prefer to review</option>
            <option value="employee_work_in_germany">
              I declare I have permission
            </option>
            <option value="not_permitted_employee_work_in_germany">
              I declare I do not have permission
            </option>
          </select>
          <small>Your declaration is not a legal determination.</small>
        </label>
      </div>
      <div className="questionnaire-grid">
        <fieldset disabled={busy}>
          <legend>Employment preferences</legend>
          {[
            ["Working student", "Working student"],
            ["Part-time", "Part time"],
            ["Minijob", "Minijob"],
            ["Short-term", "Short term"],
            ["Full-time", "Full time"],
            ["Internship", "Internship"],
          ].map(([label, value]) => (
            <label className="check" key={value}>
              <input
                type="checkbox"
                checked={employment.includes(value ?? "")}
                onChange={() => setEmployment(toggle(employment, value ?? ""))}
              />
              {label}
            </label>
          ))}
        </fieldset>
        <fieldset disabled={busy}>
          <legend>Workplace preferences</legend>
          {[
            "On-site Berlin, Germany",
            "Hybrid Berlin, Germany",
            "Remote from Germany",
          ].map((value) => (
            <label className="check" key={value}>
              <input
                type="checkbox"
                checked={locations.includes(value)}
                onChange={() => setLocations(toggle(locations, value))}
              />
              {value}
            </label>
          ))}
        </fieldset>
      </div>
      <label>
        Confirmed skills, one per line (optional)
        <textarea
          maxLength={1500}
          disabled={busy}
          value={skills}
          onChange={(event) => setSkills(event.target.value)}
          placeholder="Only skills you actually have"
        />
      </label>
      <label>
        Previous experience (optional)
        <textarea
          maxLength={270}
          disabled={busy}
          value={experience}
          onChange={(event) => setExperience(event.target.value)}
          placeholder="Describe your real experience"
        />
      </label>
      <label>
        Desired roles, industries or search keywords (optional)
        <textarea
          maxLength={300}
          disabled={busy}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search preferences are not evidence of skills or experience"
        />
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
          disabled={busy}
        />
        I confirm these answers are my own declarations. I will review the
        combined facts before approving a profile version.
      </label>
      <button
        type="button"
        disabled={busy || !confirmed}
        onClick={() => void save()}
      >
        Save questionnaire answers
      </button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
