import { CodeEditor as SharedCodeEditor } from "../../components/CodeEditor";

type Props = {
  value: string;
  onChange: (value: string) => void;
};

export function CodeEditor({ value, onChange }: Props) {
  return <SharedCodeEditor value={value} onChange={onChange} language="html" />;
}
