// Augment lucide-react to fix TypeScript module resolution issues with bundler mode
declare module 'lucide-react' {
  import { ForwardRefExoticComponent, RefAttributes, SVGProps } from 'react'

  type LucideProps = Partial<SVGProps<SVGSVGElement>> &
    RefAttributes<SVGSVGElement> & {
      size?: string | number
      absoluteStrokeWidth?: boolean
    }

  type LucideIcon = ForwardRefExoticComponent<
    Omit<LucideProps, 'ref'> & RefAttributes<SVGSVGElement>
  >

  // Re-export icons that TypeScript can't find due to module resolution
  export const Blocks: LucideIcon
  export const Link2: LucideIcon
  export const Link2Off: LucideIcon
  export const CloudUpload: LucideIcon
  export const UploadCloud: LucideIcon
  export const Mic: LucideIcon
  export const Mic2: LucideIcon
  export const MicOff: LucideIcon
  export const Paperclip: LucideIcon
  export const ThumbsUp: LucideIcon
  export const ThumbsDown: LucideIcon
  export const Webhook: LucideIcon
  export const WebhookOff: LucideIcon
  export const Settings2: LucideIcon
  export const Layout: LucideIcon
  export const LayoutDashboard: LucideIcon
  export const LayoutGrid: LucideIcon
  export const LayoutList: LucideIcon
  export const Image: LucideIcon
  export const ImageIcon: LucideIcon

  // Device icons
  export const Monitor: LucideIcon
  export const Tablet: LucideIcon
  export const Smartphone: LucideIcon

  // Data/storage icons
  export const HardDrive: LucideIcon
  export const Receipt: LucideIcon
  export const BookOpen: LucideIcon
  export const Wrench: LucideIcon

  // UI icons
  export const PanelLeft: LucideIcon
  export const Bell: LucideIcon
  export const BellRing: LucideIcon
  export const Home: LucideIcon
  export const FolderKanban: LucideIcon
  export const ListTodo: LucideIcon
  export const Calendar: LucideIcon
  export const KeyRound: LucideIcon
  export const Moon: LucideIcon
  export const Sun: LucideIcon

  // Analytics icons
  export const DollarSign: LucideIcon
  export const ArrowUpDown: LucideIcon
  export const MousePointer: LucideIcon
  export const Loader2: LucideIcon
  export const TrendingDown: LucideIcon

  // Code/file icons
  export const File: LucideIcon
  export const FileCode: LucideIcon
  export const FileInput: LucideIcon
  export const FileUp: LucideIcon
  export const Archive: LucideIcon
  export const FormInput: LucideIcon

  // Science/test icons
  export const FlaskConical: LucideIcon
  export const TestTube: LucideIcon
  export const TestTube2: LucideIcon
  export const BrainCircuit: LucideIcon

  // Git/version icons
  export const GitCompare: LucideIcon
  export const GitMerge: LucideIcon
  export const History: LucideIcon
  export const StepBack: LucideIcon
  export const Pin: LucideIcon

  // Table/grid icons
  export const Columns: LucideIcon
  export const Columns3: LucideIcon
  export const Rows3: LucideIcon
  export const Table2: LucideIcon
  export const Grid3x3: LucideIcon
  export const Grid3X3: LucideIcon

  // Navigation/action icons
  export const ArrowUpRight: LucideIcon
  export const PlayCircle: LucideIcon
  export const Images: LucideIcon
  export const ZoomIn: LucideIcon
  export const ZoomOut: LucideIcon
  export const SortAsc: LucideIcon
  export const SortDesc: LucideIcon
  export const SlidersHorizontal: LucideIcon
  export const ScanText: LucideIcon
  export const Phone: LucideIcon
  export const ListChecks: LucideIcon
  export const List: LucideIcon
  export const LayoutTemplate: LucideIcon
  export const CheckSquare: LucideIcon
  export const AlignLeft: LucideIcon
  export const MousePointer2: LucideIcon

  // Security icons
  export const Shield: LucideIcon
  export const ShieldAlert: LucideIcon
  export const ShieldBan: LucideIcon

  // Link icons
  export const Unlink: LucideIcon
  export const Unlink2: LucideIcon

  // Finance icons
  export const Wallet: LucideIcon
  export const WalletMinimal: LucideIcon
  export const WalletCards: LucideIcon
  export const CreditCard: LucideIcon

  // Communication/notification icons
  export const Inbox: LucideIcon
  export const Globe: LucideIcon
  export const Hash: LucideIcon
  export const Mail: LucideIcon
  export const Mailbox: LucideIcon
  export const MessageCircle: LucideIcon
  export const Send: LucideIcon

  // Icons missing from TS resolution
  export const Boxes: LucideIcon
  export const Scan: LucideIcon
  export const Thermometer: LucideIcon
  export const Hammer: LucideIcon
}
