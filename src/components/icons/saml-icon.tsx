import * as React from "react"

export const SamlIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 100 100"
    width="100px"
    height="100px"
    {...props}
  >
    <rect width="100" height="100" rx="15" className="fill-slate-600" />
    <text
      x="50%"
      y="50%"
      dominantBaseline="central"
      textAnchor="middle"
      fill="white"
      fontSize="40"
      fontWeight="bold"
      fontFamily="Arial, sans-serif"
    >
      SSO
    </text>
  </svg>
)
