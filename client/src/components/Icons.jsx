// Small line icons (24×24, drawn with the current text colour)
const Svg = ({ size = 20, children, ...rest }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...rest}
  >
    {children}
  </svg>
);

export const BagIcon = (p) => (
  <Svg {...p}><path d="M6 7h12l1 13H5L6 7Z" /><path d="M9 7a3 3 0 0 1 6 0" /></Svg>
);
export const UserIcon = (p) => (
  <Svg {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></Svg>
);
export const SearchIcon = (p) => (
  <Svg {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Svg>
);
export const MenuIcon = (p) => (
  <Svg {...p}><path d="M4 7h16M4 12h16M4 17h16" /></Svg>
);
export const CloseIcon = (p) => (
  <Svg {...p}><path d="M6 6l12 12M18 6 6 18" /></Svg>
);
export const PlusIcon = (p) => (
  <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>
);
export const MinusIcon = (p) => (
  <Svg {...p}><path d="M5 12h14" /></Svg>
);
export const TrashIcon = (p) => (
  <Svg {...p}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></Svg>
);
export const ArrowRightIcon = (p) => (
  <Svg {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Svg>
);
export const ArrowLeftIcon = (p) => (
  <Svg {...p}><path d="M19 12H5M11 6l-6 6 6 6" /></Svg>
);
export const TruckIcon = (p) => (
  <Svg {...p}><path d="M3 6h11v10H3zM14 10h4l3 3v3h-7" /><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" /></Svg>
);
export const ShieldIcon = (p) => (
  <Svg {...p}><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z" /><path d="m9 12 2 2 4-4" /></Svg>
);
export const RefreshIcon = (p) => (
  <Svg {...p}><path d="M20 11a8 8 0 0 0-14.9-3M4 4v4h4M4 13a8 8 0 0 0 14.9 3M20 20v-4h-4" /></Svg>
);
export const FilterIcon = (p) => (
  <Svg {...p}><path d="M4 6h16M7 12h10M10 18h4" /></Svg>
);
export const CheckIcon = (p) => (
  <Svg {...p}><path d="M20 6 9 17l-5-5" /></Svg>
);
export const GridIcon = (p) => (
  <Svg {...p}><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></Svg>
);
export const TagIcon = (p) => (
  <Svg {...p}><path d="M3 12V4h8l10 10-8 8L3 12Z" /><circle cx="7.5" cy="8.5" r="1.5" /></Svg>
);
export const BoxIcon = (p) => (
  <Svg {...p}><path d="M3 7l9-4 9 4v10l-9 4-9-4V7Z" /><path d="M3 7l9 4 9-4M12 11v10" /></Svg>
);
export const ChartIcon = (p) => (
  <Svg {...p}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></Svg>
);
export const StoreIcon = (p) => (
  <Svg {...p}><path d="M4 9l1-5h14l1 5M4 9v11h16V9M4 9h16M9 20v-6h6v6" /></Svg>
);
export const LogoutIcon = (p) => (
  <Svg {...p}><path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" /></Svg>
);
export const LockIcon = (p) => (
  <Svg {...p}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></Svg>
);
