import vrennIcon from "@/assets/vrenn-icon.png.asset.json";

interface Props { size?: number; className?: string; showWordmark?: boolean; vertical?: boolean }

export function VyraLogo({ size = 48, className = "", showWordmark = true, vertical = false }: Props) {
  return (
    <div className={`inline-flex ${vertical ? "flex-col" : "flex-row"} items-center gap-2 ${className}`}>
      <img
        src={vrennIcon.url}
        alt="VRENN"
        width={size}
        height={size}
        loading="lazy"
        style={{ width: size, height: size, objectFit: "contain", filter: "drop-shadow(0 0 18px rgba(168,85,247,0.55))" }}
      />
      {showWordmark && (
        <span
          style={{
            fontSize: vertical ? size * 0.38 : size * 0.5,
            fontWeight: 300,
            letterSpacing: vertical ? "0.4em" : "0.18em",
            paddingLeft: vertical ? "0.4em" : 0,
            color: "#fff",
            fontFamily: "Inter, sans-serif",
          }}
        >
          VRENN
        </span>
      )}
    </div>
  );
}
