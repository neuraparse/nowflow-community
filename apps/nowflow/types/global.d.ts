// Global type definitions for missing packages

declare module 'lucide-react' {
  import { ComponentType, SVGProps } from 'react'

  export interface IconProps extends SVGProps<SVGSVGElement> {
    size?: number | string
    strokeWidth?: number | string
  }

  export type Icon = ComponentType<IconProps>

  // Common icons used in the app
  export const Activity: Icon
  export const AlignVerticalDistributeEnd: Icon
  export const AlertCircle: Icon
  export const AlertCircleIcon: Icon
  export const AlertTriangle: Icon
  export const AlertTriangleIcon: Icon
  export const Atom: Icon
  export const Award: Icon
  export const ArrowDown: Icon
  export const ArrowLeft: Icon
  export const ArrowRight: Icon
  export const ArrowRightIcon: Icon
  export const ArrowUp: Icon
  export const BarChart3: Icon
  export const Bookmark: Icon
  export const BookmarkCheck: Icon
  export const BellRing: Icon
  export const BookOpen: Icon
  export const Bot: Icon
  export const BotMessageSquare: Icon
  export const Brain: Icon
  export const Bug: Icon
  export const Building: Icon
  export const Calendar: Icon
  export const Camera: Icon
  export const Cloud: Icon
  export const ClockIcon: Icon
  export const CornerDownLeft: Icon
  export const Check: Icon
  export const CheckCheck: Icon
  export const CheckCircle: Icon
  export const CheckCircle2: Icon
  export const CheckIcon: Icon
  export const CheckSquareIcon: Icon
  export const ChevronDown: Icon
  export const ChevronDownSquare: Icon
  export const ChevronLeft: Icon
  export const ChevronLeftIcon: Icon
  export const ChevronRight: Icon
  export const ChevronRightIcon: Icon
  export const ChevronsLeftIcon: Icon
  export const ChevronsRightIcon: Icon
  export const ChevronsUpDown: Icon
  export const ChevronUp: Icon
  export const ChevronUpSquare: Icon
  export const Circle: Icon
  export const Clock: Icon
  export const Code: Icon
  export const CodeXml: Icon
  export const Copy: Icon
  export const CreditCard: Icon
  export const Crown: Icon
  export const Cpu: Icon
  export const Database: Icon
  export const Download: Icon
  export const Edit: Icon
  export const Edit2: Icon
  export const Edit3: Icon
  export const ExternalLink: Icon
  export const Eye: Icon
  export const EyeOff: Icon
  export const FileIcon: Icon
  export const FileJson: Icon
  export const FileText: Icon
  export const Filter: Icon
  export const Flame: Icon
  export const FolderOpen: Icon
  export const Gauge: Icon
  export const GitBranch: Icon
  export const Github: Icon
  export const GitPullRequestCreate: Icon
  export const GitPullRequestCreateArrow: Icon
  export const Globe: Icon
  export const Grid3X3: Icon
  export const GripHorizontal: Icon
  export const GripVertical: Icon
  export const Group: Icon
  export const Heart: Icon
  export const HardDrive: Icon
  export const Hash: Icon
  export const HelpCircle: Icon
  export const Image: Icon
  export const Info: Icon
  export const InfoIcon: Icon
  export const Key: Icon
  export const KeyRound: Icon
  export const KeySquare: Icon
  export const Layers: Icon
  export const LayoutDashboard: Icon
  export const Laptop: Icon
  export const Lightbulb: Icon
  export const LineChart: Icon
  export const Link: Icon
  export const Loader2: Icon
  export const Lock: Icon
  export const LockIcon: Icon
  export const LogOut: Icon
  export const Mail: Icon
  export const MailIcon: Icon
  export const Map: Icon
  export const Maximize2: Icon
  export const MaximizeIcon: Icon
  export const MemoryStick: Icon
  export const Menu: Icon
  export const Moon: Icon
  export const Music: Icon
  export const MessageCircle: Icon
  export const MessageSquare: Icon
  export const MessageSquarePlus: Icon
  export const Minimize2: Icon
  export const MinimizeIcon: Icon
  export const Minus: Icon
  export const MoreHorizontal: Icon
  export const MoreVertical: Icon
  export const Move: Icon
  export const Network: Icon
  export const Package: Icon
  export const Palette: Icon
  export const PanelRight: Icon
  export const Pause: Icon
  export const Pencil: Icon
  export const PenLine: Icon
  export const Play: Icon
  export const Plus: Icon
  export const PlusCircle: Icon
  export const PieChart: Icon
  export const PlusIcon: Icon
  export const Puzzle: Icon
  export const Quote: Icon
  export const Receipt: Icon
  export const Redo2: Icon
  export const RefreshCw: Icon
  export const Rocket: Icon
  export const RotateCcw: Icon
  export const RotateCcwIcon: Icon
  export const Save: Icon
  export const ScrollText: Icon
  export const Search: Icon
  export const SearchIcon: Icon
  export const Send: Icon
  export const SendIcon: Icon
  export const Server: Icon
  export const Settings: Icon
  export const Share2: Icon
  export const Shield: Icon
  export const ShieldCheck: Icon
  export const ShoppingCart: Icon
  export const SkipForward: Icon
  export const Sliders: Icon
  export const Snowflake: Icon
  export const Sparkles: Icon
  export const Square: Icon
  export const SquareIcon: Icon
  export const Star: Icon
  export const Sun: Icon
  export const Stars: Icon
  export const StepForward: Icon
  export const Store: Icon
  export const Tag: Icon
  export const Target: Icon
  export const Terminal: Icon
  export const Timer: Icon
  export const ToggleLeft: Icon
  export const ToggleRight: Icon
  export const Trash: Icon
  export const Trash2: Icon
  export const TrendingUp: Icon
  export const Truck: Icon
  export const Twitter: Icon
  export const Type: Icon
  export const Undo2: Icon
  export const Ungroup: Icon
  export const Unlock: Icon
  export const Upload: Icon
  export const User: Icon
  export const Video: Icon
  export const Wand2: Icon
  export const UserCheck: Icon
  export const UserCheckIcon: Icon
  export const UserIcon: Icon
  export const UserMinus: Icon
  export const UserPlus: Icon
  export const Users: Icon
  export const UserX: Icon
  export const UserXIcon: Icon
  export const Wifi: Icon
  export const Workflow: Icon
  export const WorkflowIcon: Icon
  export const Wrench: Icon
  export const WrenchIcon: Icon
  export const X: Icon
  export const XCircle: Icon
  export const XIcon: Icon
  export const Zap: Icon
}

declare module 'framer-motion' {
  import {
    AnchorHTMLAttributes,
    ButtonHTMLAttributes,
    ComponentType,
    HTMLAttributes,
    ReactNode,
  } from 'react'

  export interface MotionProps extends HTMLAttributes<HTMLElement> {
    initial?: any
    animate?: any
    exit?: any
    transition?: any
    variants?: any
    whileHover?: any
    whileTap?: any
    whileInView?: any
    whileDrag?: any
    viewport?: any
    drag?: boolean | 'x' | 'y'
    dragConstraints?: any
    dragMomentum?: boolean
    onDragStart?: () => void
    onDragEnd?: () => void
    layout?: boolean | string
    layoutId?: string
    children?: ReactNode
    href?: string
    target?: string
    rel?: string
    'aria-label'?: string
  }

  export const motion: {
    div: ComponentType<MotionProps>
    span: ComponentType<MotionProps>
    p: ComponentType<MotionProps>
    h1: ComponentType<MotionProps>
    h2: ComponentType<MotionProps>
    h3: ComponentType<MotionProps>
    button: ComponentType<MotionProps & ButtonHTMLAttributes<HTMLButtonElement>>
    a: ComponentType<MotionProps & AnchorHTMLAttributes<HTMLAnchorElement>>
    [key: string]: ComponentType<MotionProps>
  }

  // `m` is the lightweight motion component (used with LazyMotion) — same
  // surface as `motion` for our purposes.
  export const m: typeof motion

  export const AnimatePresence: ComponentType<{
    children?: ReactNode
    mode?: 'wait' | 'sync' | 'popLayout'
    initial?: boolean
  }>

  // LazyMotion + feature bundles for tree-shakable framer-motion.
  export const domAnimation: any
  export const domMax: any
  export const LazyMotion: ComponentType<{
    children?: ReactNode
    features: any
    strict?: boolean
  }>

  export const useAnimation: () => any
  export const useReducedMotion: () => boolean | null
  export const useMotionValue: (initial: any) => any
  export const useSpring: (value: any, config?: any) => any
  export const useTransform: (value: any, input: any[], output: any[]) => any
  export const LayoutGroup: ComponentType<{
    children?: ReactNode
    id?: string
  }>
}

declare module 'date-fns' {
  export function format(date: Date | number, formatStr: string): string
  export function parseISO(dateString: string): Date
  export function isValid(date: any): boolean
  export function addDays(date: Date, amount: number): Date
  export function subDays(date: Date, amount: number): Date
  export function startOfDay(date: Date): Date
  export function endOfDay(date: Date): Date
  export function formatDistanceToNow(
    date: Date | number,
    options?: { addSuffix?: boolean; locale?: any }
  ): string
}

declare module 'drizzle-orm' {
  export function sql(strings: TemplateStringsArray, ...values: any[]): any
  export function eq(column: any, value: any): any
  export function and(...conditions: any[]): any
  export function or(...conditions: any[]): any
  export function like(column: any, value: any): any
  export function ilike(column: any, value: any): any
  export function inArray(column: any, values: any[]): any
  export function desc(column: any): any
  export function asc(column: any): any
  export const count: any
  export function sum(column?: any): any
  export function avg(column?: any): any
  export function min(column?: any): any
  export function max(column?: any): any
  export function gte(column: any, value: any): any
  export function gt(column: any, value: any): any
  export function lte(column: any, value: any): any
  export function lt(column: any, value: any): any
  export function ne(column: any, value: any): any
  export function isNull(column: any): any
  export function isNotNull(column: any): any
  export function exists(query: any): any
  export function notExists(query: any): any
  export type SQL = any
}

declare module 'drizzle-orm/postgres-js' {
  export function drizzle(client: any, config?: any): any
}

declare module 'drizzle-orm/pg-core' {
  export function pgTable(name: string, columns: any, extraConfig?: any): any
  export function text(name?: string): any
  export function boolean(name?: string): any
  export function timestamp(name?: string, config?: any): any
  export function foreignKey(config: any): any
  export function unique(name?: string): any
  export function serial(name?: string): any
  export function integer(name?: string): any
  export function json(name?: string): any
  export function jsonb(name?: string): any
  export function decimal(name?: string, config?: any): any
  export function varchar(name?: string, config?: any): any
  export function uniqueIndex(name: string, columns: any[]): any
}

declare module 'drizzle-orm/relations' {
  export function relations(table: any, callback: (helpers: any) => any): any
}

declare module '@cerebras/cerebras_cloud_sdk' {
  export class Cerebras {
    constructor(config: { apiKey: string })
    chat: {
      completions: {
        create(params: any): Promise<any>
      }
    }
  }
}

declare module 'react-hook-form' {
  export function useForm<T = any>(
    config?: any
  ): {
    register: (name: string, options?: any) => any
    handleSubmit: (onSubmit: (data: T) => void) => (e?: any) => void
    formState: {
      errors: any
      isSubmitting: boolean
      isValid: boolean
    }
    watch: (name?: string) => any
    setValue: (name: string, value: any) => void
    getValues: () => T
    reset: (data?: Partial<T>) => void
    control: any
  }

  export interface FieldError {
    message?: string
    type?: string
  }

  export const Controller: ComponentType<any>
  export interface ControllerProps<
    TFieldValues = any,
    TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
  > {
    name: string
    control?: any
    render: (props: any) => ReactNode
  }
  export type FieldPath<T> = string
  export type FieldValues = Record<string, any>
  export const FormProvider: ComponentType<any>
  export function useFormContext(): any
  export function useWatch<T = any>(props?: any): any

  export interface UseFormReturn<T = any> {
    register: any
    handleSubmit: any
    formState: any
    watch: any
    setValue: any
    getValues: any
    reset: any
  }
}

declare module '@hookform/resolvers/zod' {
  export function zodResolver(schema: any): any
}

declare module 'reactflow' {
  import { ComponentType, ReactNode, CSSProperties } from 'react'

  export interface Node<T = any> {
    id: string
    type?: string
    data: T
    position: { x: number; y: number }
    width?: number
    height?: number
    style?: CSSProperties
    className?: string
    targetPosition?: Position
    sourcePosition?: Position
    hidden?: boolean
    selected?: boolean
    dragging?: boolean
    draggable?: boolean
    dragHandle?: string
    extent?: 'parent' | [[number, number], [number, number]]
    expandParent?: boolean
    positionAbsolute?: { x: number; y: number }
    ariaLabel?: string
    focusable?: boolean
    resizing?: boolean
    deletable?: boolean
    connectable?: boolean
    selectable?: boolean
    parentNode?: string
    zIndex?: number
  }

  export interface Edge<T = any> {
    id: string
    source: string
    target: string
    sourceHandle?: string | null
    targetHandle?: string | null
    type?: string
    data?: T
    style?: CSSProperties
    className?: string
    animated?: boolean
    hidden?: boolean
    selected?: boolean
    markerStart?: EdgeMarker
    markerEnd?: EdgeMarker
    zIndex?: number
    ariaLabel?: string
    interactionWidth?: number
    focusable?: boolean
    deletable?: boolean
    updatable?: boolean
    pathOptions?: any
  }

  export interface EdgeMarker {
    type: MarkerType
    color?: string
    width?: number
    height?: number
    markerUnits?: string
    orient?: string
    strokeWidth?: number
  }

  export enum Position {
    Left = 'left',
    Top = 'top',
    Right = 'right',
    Bottom = 'bottom',
  }

  export enum MarkerType {
    Arrow = 'arrow',
    ArrowClosed = 'arrowclosed',
  }

  export enum ConnectionLineType {
    Bezier = 'default',
    Straight = 'straight',
    Step = 'step',
    SmoothStep = 'smoothstep',
    SimpleBezier = 'simplebezier',
  }

  export interface NodeProps<T = any> {
    id: string
    data: T
    type: string
    selected: boolean
    isConnectable: boolean
    zIndex: number
    xPos: number
    yPos: number
    dragging: boolean
    targetPosition?: Position
    sourcePosition?: Position
  }

  export interface EdgeProps<T = any> {
    id: string
    source: string
    target: string
    sourceX: number
    sourceY: number
    targetX: number
    targetY: number
    sourcePosition: Position
    targetPosition: Position
    data?: T
    style?: CSSProperties
    markerStart?: string
    markerEnd?: string
    pathOptions?: any
  }

  export interface HandleProps {
    type: 'source' | 'target'
    position: Position
    id?: string
    style?: CSSProperties
    className?: string
    onConnect?: (params: any) => void
    isValidConnection?: (connection: any) => boolean
    isConnectable?: boolean
    isConnectableStart?: boolean
    isConnectableEnd?: boolean
    'data-nodeid'?: string
    'data-handleid'?: string
    key?: string
  }

  export interface Viewport {
    x: number
    y: number
    zoom: number
  }

  export type NodeTypes = Record<string, ComponentType<NodeProps>>
  export type EdgeTypes = Record<string, ComponentType<EdgeProps>>

  export const Handle: ComponentType<HandleProps>

  export const ReactFlowProvider: ComponentType<{ children: ReactNode }>

  export function useNodesState<T = any>(initialNodes: Node<T>[]): [Node<T>[], any, any]
  export function useEdgesState<T = any>(initialEdges: Edge<T>[]): [Edge<T>[], any, any]
  export function useReactFlow(): any
  export function useUpdateNodeInternals(): (nodeId: string) => void

  export function getSmoothStepPath(params: {
    sourceX: number
    sourceY: number
    sourcePosition: Position
    targetX: number
    targetY: number
    targetPosition: Position
    borderRadius?: number
    centerX?: number
    centerY?: number
    offset?: number
  }): [string, number, number]

  export const BaseEdge: ComponentType<{
    path: string
    markerEnd?: string
    markerStart?: string
    style?: CSSProperties
    className?: string
    interactionWidth?: number
  }>

  export const MiniMap: ComponentType<any>
  export const Background: ComponentType<any>
  export const Controls: ComponentType<any>
  export const EdgeLabelRenderer: ComponentType<any>

  export default ComponentType<{
    nodes: Node[]
    edges: Edge[]
    onNodesChange?: (changes: any[]) => void
    onEdgesChange?: (changes: any[]) => void
    onConnect?: (params: any) => void
    nodeTypes?: NodeTypes
    edgeTypes?: EdgeTypes
    defaultViewport?: Viewport
    fitView?: boolean
    children?: ReactNode
    className?: string
    style?: CSSProperties
    [key: string]: any
  }>
}

declare global {
  interface Window {
    gtag?: (...args: any[]) => void
    crypto: Crypto
  }

  interface Crypto {
    subtle: SubtleCrypto
    getRandomValues<T extends ArrayBufferView | null>(array: T): T
    randomUUID(): string
  }
}
