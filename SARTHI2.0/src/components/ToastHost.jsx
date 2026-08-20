import { useEffect, useState } from "react";
import { onToast } from "../lib/notify";
import { CheckCircle2, AlertTriangle, XCircle, Info, ArrowRightCircle } from "lucide-react";

const ICONS = {
  success: <CheckCircle2 size={18} className="text-mint-600" />,
  warning: <AlertTriangle size={18} className="text-amber-600" />,
  error: <XCircle size={18} className="text-coral-600" />,
  match: <ArrowRightCircle size={18} className="text-teal-700" />,
  info: <Info size={18} className="text-teal-700" />,
};

export default function ToastHost() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    return onToast(({ id, message, kind }) => {
      setItems((prev) => [...prev, { id, message, kind }]);
      setTimeout(() => {
        setItems((prev) => prev.filter((i) => i.id !== id));
      }, 5000);
    });
  }, []);

  return (
    <div className="fixed top-4 right-4 left-4 sm:left-auto z-[9999] flex flex-col gap-2 sm:w-80">
      {items.map((item) => (
        <div
          key={item.id}
          className="animate-slideIn card flex items-start gap-2.5 px-3.5 py-3 text-sm"
        >
          {ICONS[item.kind] || ICONS.info}
          <p className="text-ink/85 leading-snug">{item.message}</p>
        </div>
      ))}
    </div>
  );
}
