import type { FormEvent } from "react";

interface UrlFormProps {
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
}

export function UrlForm({ value, disabled, onChange, onSubmit }: UrlFormProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <form className="command-form" onSubmit={handleSubmit}>
      <label className="sr-only" htmlFor="scan-url">
        Landing page URL
      </label>
      <input
        id="scan-url"
        className="command-input"
        name="scan-url"
        type="url"
        inputMode="url"
        autoComplete="off"
        placeholder="https://your-site.com"
        aria-describedby="command-help"
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </form>
  );
}
