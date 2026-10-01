import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { Maximize2, Minimize2, RefreshCw, Info, ZoomIn, ZoomOut } from 'lucide-react'

export interface GraphResource {
  video_id: string
  title: string
  url: string
  channel: string | null
  overall_score: number | null
  concepts_covered: string[] | null
}

interface Node {
  id: string
  label: string
  type: 'query' | 'video' | 'concept'
  x: number
  y: number
  size: number
  color: string
  originalData?: GraphResource
}

interface Link {
  source: string
  target: string
}

interface KnowledgeGraphProps {
  query: string
  resources: GraphResource[]
  topics: string[]
}

const VB_W = 800
const VB_H = 450
const MIN_ZOOM = 0.4
const MAX_ZOOM = 2.5

export default function KnowledgeGraph({ query, resources, topics }: KnowledgeGraphProps) {
  const [isOpen, setIsOpen] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  // Zoom & Pan state
  const [transform, _setTransform] = useState({ x: 0, y: 0, k: 1 })
  const transformRef = useRef({ x: 0, y: 0, k: 1 })

  const setTransform = useCallback(
    (updater: { x: number; y: number; k: number } | ((prev: { x: number; y: number; k: number }) => { x: number; y: number; k: number })) => {
      _setTransform(prev => {
        const next = typeof updater === 'function' ? updater(prev) : updater
        transformRef.current = next
        return next
      })
    },
    []
  )

  // Nodes & Links (Stationary, deterministic layout - ZERO jitter)
  const [nodes, setNodes] = useState<Node[]>([])
  const [links, setLinks] = useState<Link[]>([])
  const nodesRef = useRef<Node[]>([])

  // Keep nodesRef in sync
  useEffect(() => {
    nodesRef.current = nodes
  }, [nodes])

  // Dragging state
  const draggedNodeIdRef = useRef<string | null>(null)
  const isDraggingNodeRef = useRef(false)

  // Panning state
  const isPanningRef = useRef(false)
  const panStartRef = useRef({ clientX: 0, clientY: 0, tx: 0, ty: 0 })

  // Pinch-to-zoom state (mobile)
  const pinchRef = useRef<{ dist: number } | null>(null)

  // Hover state (node highlight + tooltip)
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
  const [hoveredNode, setHoveredNode] = useState<Node | null>(null)

  // --- 1. Deterministic Layout Generator (Completely Stable, No Physics Jitter) ---
  const buildLayout = useCallback(() => {
    if (!query) return

    const cx = VB_W / 2
    const cy = VB_H / 2

    const newNodes: Node[] = []
    const newLinks: Link[] = []

    // 1. Center Topic Node
    newNodes.push({
      id: 'query',
      label: query,
      type: 'query',
      x: cx,
      y: cy,
      size: 20,
      color: '#ffffff',
    })

    // 2. Video Nodes (Inner Circle)
    const numVideos = resources.length
    const videoAngles = new Map<string, number>()
    const rVideoX = 135
    const rVideoY = 110

    resources.forEach((res, i) => {
      const angle = numVideos > 0 ? (i / numVideos) * Math.PI * 2 - Math.PI / 2 : 0
      const vid = `video_${res.video_id}`
      videoAngles.set(vid, angle)

      const cleanTitle = (res.title && !['none', 'null', 'n/a', ''].includes(res.title.trim().toLowerCase()))
        ? res.title
        : (res.video_id ? `Video (${res.video_id})` : 'Untitled Video')

      newNodes.push({
        id: vid,
        label: cleanTitle,
        type: 'video',
        x: cx + Math.cos(angle) * rVideoX,
        y: cy + Math.sin(angle) * rVideoY,
        size: 13,
        color: '#00f0ff',
        originalData: res,
      })
      newLinks.push({ source: 'query', target: vid })
    })

    // 3. Unique Concepts & their connected videos
    const conceptToVideos = new Map<string, string[]>()

    resources.forEach(res => {
      const vid = `video_${res.video_id}`
      res.concepts_covered?.forEach(concept => {
        const clean = concept?.trim()
        if (!clean) return
        if (!conceptToVideos.has(clean)) conceptToVideos.set(clean, [])
        conceptToVideos.get(clean)!.push(vid)
      })
    })

    topics.forEach(topic => {
      const clean = topic?.trim()
      if (!clean) return
      if (!conceptToVideos.has(clean)) conceptToVideos.set(clean, [])
    })

    const conceptList = Array.from(conceptToVideos.keys())

    // Calculate preferred radial angle for each concept to minimize crossing lines
    const conceptTargets: { name: string; targetAngle: number }[] = conceptList.map(name => {
      const connectedVids = conceptToVideos.get(name) || []
      if (connectedVids.length > 0) {
        let sumX = 0
        let sumY = 0
        connectedVids.forEach(vid => {
          const ang = videoAngles.get(vid) ?? 0
          sumX += Math.cos(ang)
          sumY += Math.sin(ang)
        })
        const avgAngle = Math.atan2(sumY, sumX)
        return { name, targetAngle: (avgAngle + Math.PI * 2) % (Math.PI * 2) }
      }
      return { name, targetAngle: 0 }
    })

    // Sort concepts so neighbors on the circle connect to nearby videos
    conceptTargets.sort((a, b) => a.targetAngle - b.targetAngle)

    // 4. Distribute concept nodes evenly along outer ellipse
    const numConcepts = conceptTargets.length
    const rConceptX = 270
    const rConceptY = 175

    conceptTargets.forEach((ct, i) => {
      const angle = numConcepts > 0 ? (i / numConcepts) * Math.PI * 2 - Math.PI / 2 : 0
      const cid = `concept_${ct.name}`

      newNodes.push({
        id: cid,
        label: ct.name,
        type: 'concept',
        x: cx + Math.cos(angle) * rConceptX,
        y: cy + Math.sin(angle) * rConceptY,
        size: 7.5,
        color: '#a855f7',
      })

      const parentVids = conceptToVideos.get(ct.name) || []
      if (parentVids.length > 0) {
        parentVids.forEach(vid => {
          newLinks.push({ source: vid, target: cid })
        })
      } else {
        newLinks.push({ source: 'query', target: cid })
      }
    })

    setNodes(newNodes)
    setLinks(newLinks)
    setTransform({ x: 0, y: 0, k: 1 })
  }, [query, resources, topics, setTransform])

  // Initialize layout when props change
  useEffect(() => {
    buildLayout()
  }, [buildLayout])

  // --- 2. Screen to ViewBox Coordinate Transformation ---
  const clientToVB = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current
    if (!svg) return { vx: VB_W / 2, vy: VB_H / 2 }
    const ctm = svg.getScreenCTM()
    if (!ctm) {
      const rect = svg.getBoundingClientRect()
      return {
        vx: (clientX - rect.left) * (VB_W / (rect.width || 1)),
        vy: (clientY - rect.top) * (VB_H / (rect.height || 1)),
      }
    }
    const pt = svg.createSVGPoint()
    pt.x = clientX
    pt.y = clientY
    const res = pt.matrixTransform(ctm.inverse())
    return { vx: res.x, vy: res.y }
  }, [])

  // --- 3. Zoom Anchored at ViewBox Point (vx, vy) ---
  const zoomAt = useCallback((vx: number, vy: number, factor: number) => {
    setTransform(prev => {
      const nextK = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev.k * factor))
      if (Math.abs(nextK - prev.k) < 1e-5) return prev
      const scale = nextK / prev.k
      return {
        x: vx - (vx - prev.x) * scale,
        y: vy - (vy - prev.y) * scale,
        k: nextK,
      }
    })
  }, [setTransform])

  // --- 4. Native Wheel Handler (Controlled, Smooth Zoom) ---
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      e.stopPropagation()

      if (Math.abs(e.deltaY) < 1e-4) return

      let dy = e.deltaY
      if (e.deltaMode === 1) dy *= 16
      else if (e.deltaMode === 2) dy *= 40

      // Clamp delta to prevent erratic jumps on sudden trackpad scrolls
      dy = Math.max(-50, Math.min(50, dy))

      // Gentle exponential scaling (~4% per notch)
      const factor = Math.exp(-dy * 0.001)

      const { vx, vy } = clientToVB(e.clientX, e.clientY)
      zoomAt(vx, vy, factor)
    }

    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
  }, [clientToVB, zoomAt])

  // --- 5. Mouse Interactions (Pan, Drag Node, Tooltip) ---
  const handleSVGMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return
    if (isDraggingNodeRef.current) return

    // Pan starts
    isPanningRef.current = true
    panStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      tx: transformRef.current.x,
      ty: transformRef.current.y,
    }
  }

  const handleSVGMouseMove = (e: React.MouseEvent) => {
    // 1. Move tooltip directly via DOM without React state re-rendering
    if (tooltipRef.current && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      const x = Math.min(rect.width - 270, Math.max(12, e.clientX - rect.left + 16))
      const y = Math.min(rect.height - 150, Math.max(12, e.clientY - rect.top + 16))
      tooltipRef.current.style.transform = `translate3d(${x}px, ${y}px, 0)`
    }

    // 2. Drag single node if active
    if (draggedNodeIdRef.current) {
      const { vx, vy } = clientToVB(e.clientX, e.clientY)
      const cur = transformRef.current
      const graphX = (vx - cur.x) / cur.k
      const graphY = (vy - cur.y) / cur.k

      setNodes(prev =>
        prev.map(node =>
          node.id === draggedNodeIdRef.current
            ? { ...node, x: graphX, y: graphY }
            : node
        )
      )
      return
    }

    // 3. Pan canvas
    if (isPanningRef.current && svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect()
      const scaleX = VB_W / (rect.width || 1)
      const scaleY = VB_H / (rect.height || 1)

      const dx = (e.clientX - panStartRef.current.clientX) * scaleX
      const dy = (e.clientY - panStartRef.current.clientY) * scaleY

      setTransform({
        k: transformRef.current.k,
        x: panStartRef.current.tx + dx,
        y: panStartRef.current.ty + dy,
      })
    }
  }

  const handleSVGMouseUp = () => {
    draggedNodeIdRef.current = null
    isDraggingNodeRef.current = false
    isPanningRef.current = false
  }

  // --- 6. Mobile Touch Interactions (1-finger Pan & 2-finger Pinch Zoom) ---
  const handleSVGTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const t = e.touches[0]
      isPanningRef.current = true
      panStartRef.current = {
        clientX: t.clientX,
        clientY: t.clientY,
        tx: transformRef.current.x,
        ty: transformRef.current.y,
      }
      pinchRef.current = null
    } else if (e.touches.length === 2) {
      isPanningRef.current = false
      draggedNodeIdRef.current = null
      isDraggingNodeRef.current = false
      const [t0, t1] = [e.touches[0], e.touches[1]]
      const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY)
      pinchRef.current = { dist }
    }
  }

  const handleSVGTouchMove = (e: React.TouchEvent) => {
    if (e.cancelable) e.preventDefault()

    // 2-finger pinch zoom
    if (e.touches.length === 2 && pinchRef.current) {
      const [t0, t1] = [e.touches[0], e.touches[1]]
      const newDist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY)

      if (pinchRef.current.dist > 5 && newDist > 5) {
        const factor = Math.max(0.92, Math.min(1.08, newDist / pinchRef.current.dist))
        const midX = (t0.clientX + t1.clientX) / 2
        const midY = (t0.clientY + t1.clientY) / 2
        const { vx, vy } = clientToVB(midX, midY)
        zoomAt(vx, vy, factor)
        pinchRef.current = { dist: newDist }
      }
      return
    }

    // 1-finger drag node or pan
    if (e.touches.length === 1 && !pinchRef.current) {
      const t = e.touches[0]

      if (draggedNodeIdRef.current) {
        const { vx, vy } = clientToVB(t.clientX, t.clientY)
        const cur = transformRef.current
        const graphX = (vx - cur.x) / cur.k
        const graphY = (vy - cur.y) / cur.k

        setNodes(prev =>
          prev.map(node =>
            node.id === draggedNodeIdRef.current
              ? { ...node, x: graphX, y: graphY }
              : node
          )
        )
      } else if (isPanningRef.current && svgRef.current) {
        const rect = svgRef.current.getBoundingClientRect()
        const scaleX = VB_W / (rect.width || 1)
        const scaleY = VB_H / (rect.height || 1)

        const dx = (t.clientX - panStartRef.current.clientX) * scaleX
        const dy = (t.clientY - panStartRef.current.clientY) * scaleY

        setTransform({
          k: transformRef.current.k,
          x: panStartRef.current.tx + dx,
          y: panStartRef.current.ty + dy,
        })
      }
    }
  }

  const handleSVGTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) pinchRef.current = null
    if (e.touches.length === 0) {
      draggedNodeIdRef.current = null
      isDraggingNodeRef.current = false
      isPanningRef.current = false
    }
  }

  // --- 7. Button Handlers ---
  const handleZoomIn = () => zoomAt(VB_W / 2, VB_H / 2, 1.2)
  const handleZoomOut = () => zoomAt(VB_W / 2, VB_H / 2, 1 / 1.2)
  const handleReset = () => buildLayout()

  // --- 8. Highlight Determination ---
  const connectedNodeIds = useMemo(() => {
    if (!hoveredNodeId) return new Set<string>()
    const set = new Set<string>()
    set.add(hoveredNodeId)
    links.forEach(l => {
      if (l.source === hoveredNodeId) set.add(l.target)
      if (l.target === hoveredNodeId) set.add(l.source)
    })
    return set
  }, [hoveredNodeId, links])

  const connectedLinkKeys = useMemo(() => {
    if (!hoveredNodeId) return new Set<string>()
    const set = new Set<string>()
    links.forEach(l => {
      if (l.source === hoveredNodeId || l.target === hoveredNodeId) {
        set.add(`${l.source}-${l.target}`)
      }
    })
    return set
  }, [hoveredNodeId, links])

  // Scale compensation so elements look balanced at any zoom level
  const scaleComp = Math.pow(transform.k, 0.4)
  const strokeComp = Math.pow(transform.k, 0.5)

  // Map for fast node coordinate lookup
  const nodeMap = useMemo(() => {
    const map = new Map<string, Node>()
    nodes.forEach(n => map.set(n.id, n))
    return map
  }, [nodes])

  return (
    <div className="border border-[#222222] bg-[#111111]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#1c1c1c] px-6 py-4">
        <div className="flex items-center gap-2">
          <Info size={14} className="text-[#555555]" />
          <span className="text-[10px] font-bold tracking-[0.2em] text-[#888888] uppercase">
            Interactive Video Knowledge Graph
          </span>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={handleReset}
            title="Reset layout & zoom"
            className="flex items-center gap-1.5 text-[10px] font-bold text-[#666666] hover:text-white transition-colors uppercase tracking-wider"
          >
            <RefreshCw size={11} /> Reset
          </button>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="text-[10px] font-bold text-[#666666] hover:text-white transition-colors uppercase tracking-wider"
          >
            {isOpen ? 'Collapse' : 'Expand'}
          </button>
        </div>
      </div>

      {/* Graph Container */}
      {isOpen && (
        <div
          ref={containerRef}
          className={`relative overflow-hidden bg-black select-none touch-none ${
            isFullscreen ? 'fixed inset-0 z-50 h-screen w-screen' : 'h-[500px] w-full'
          }`}
        >
          {/* Legend */}
          <div className="absolute left-4 top-4 z-10 hidden sm:flex items-center gap-4 text-[9px] text-[#555555] font-bold tracking-wider uppercase bg-[#111111]/80 backdrop-blur-sm px-3 py-1.5 rounded border border-[#222222]/50 pointer-events-none">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.6)]" /> Topic
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#00f0ff] shadow-[0_0_8px_rgba(0,240,255,0.6)]" /> Videos
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#a855f7] shadow-[0_0_8px_rgba(168,85,247,0.6)]" /> Concepts
            </div>
            <div className="ml-2 text-[8px] text-[#444444]">Scroll / Pinch to Zoom • Drag to Pan</div>
          </div>

          {/* Zoom % badge */}
          <div className="absolute left-4 bottom-4 z-10 text-[10px] font-mono text-[#555555] bg-[#111111]/80 backdrop-blur-sm px-2.5 py-1 rounded border border-[#222222]/40 pointer-events-none select-none">
            {Math.round(transform.k * 100)}%
          </div>

          {/* Floating Controls */}
          <div className="absolute right-4 bottom-4 z-10 flex flex-col gap-1.5">
            <button
              onClick={handleZoomIn}
              title="Zoom in (+)"
              className="flex h-8 w-8 items-center justify-center border border-[#222222] bg-[#111111]/80 backdrop-blur-sm text-[#cccccc] hover:border-[#555555] hover:text-white transition-colors rounded-md"
            >
              <ZoomIn size={14} />
            </button>
            <button
              onClick={handleZoomOut}
              title="Zoom out (-)"
              className="flex h-8 w-8 items-center justify-center border border-[#222222] bg-[#111111]/80 backdrop-blur-sm text-[#cccccc] hover:border-[#555555] hover:text-white transition-colors rounded-md"
            >
              <ZoomOut size={14} />
            </button>
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              className="flex h-8 w-8 items-center justify-center border border-[#222222] bg-[#111111]/80 backdrop-blur-sm text-[#cccccc] hover:border-[#555555] hover:text-white transition-colors rounded-md"
            >
              {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
          </div>

          {/* SVG Canvas */}
          <svg
            ref={svgRef}
            viewBox={`0 0 ${VB_W} ${VB_H}`}
            preserveAspectRatio="xMidYMid meet"
            className="h-full w-full cursor-grab active:cursor-grabbing"
            onMouseDown={handleSVGMouseDown}
            onMouseMove={handleSVGMouseMove}
            onMouseUp={handleSVGMouseUp}
            onMouseLeave={handleSVGMouseUp}
            onTouchStart={handleSVGTouchStart}
            onTouchMove={handleSVGTouchMove}
            onTouchEnd={handleSVGTouchEnd}
          >
            <defs>
              <filter id="glow-video" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="glow-concept" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="2.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Transform Group (Zoom & Pan applied cleanly here) */}
            <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
              {/* Edges */}
              {links.map((link, i) => {
                const s = nodeMap.get(link.source)
                const t = nodeMap.get(link.target)
                if (!s || !t) return null

                const isHighlight = hoveredNodeId ? connectedLinkKeys.has(`${link.source}-${link.target}`) : false
                const isDimmed = hoveredNodeId ? !isHighlight : false

                return (
                  <line
                    key={`link-${i}`}
                    x1={s.x}
                    y1={s.y}
                    x2={t.x}
                    y2={t.y}
                    stroke={isHighlight ? (t.type === 'concept' ? '#a855f7' : '#00f0ff') : '#222222'}
                    strokeWidth={(isHighlight ? 1.8 : 1) / strokeComp}
                    opacity={isDimmed ? 0.08 : (isHighlight ? 0.9 : 0.45)}
                    style={{ transition: 'stroke 0.15s ease, opacity 0.15s ease' }}
                  />
                )
              })}

              {/* Nodes */}
              {nodes.map(node => {
                const isHovered = node.id === hoveredNodeId
                const isConnected = hoveredNodeId ? connectedNodeIds.has(node.id) : true
                const isDimmed = hoveredNodeId ? !isConnected : false
                const opacity = isDimmed ? 0.15 : 1

                const filterGlow = node.type === 'video'
                  ? 'url(#glow-video)'
                  : node.type === 'concept' ? 'url(#glow-concept)' : undefined

                const effectiveR = node.size / scaleComp
                const labelFontSize = Math.max(7.5, Math.min(10.5, 8.5 / scaleComp))

                return (
                  <g
                    key={node.id}
                    transform={`translate(${node.x},${node.y})`}
                    className="cursor-pointer"
                    onMouseDown={e => {
                      e.stopPropagation()
                      draggedNodeIdRef.current = node.id
                      isDraggingNodeRef.current = true
                    }}
                    onTouchStart={e => {
                      e.stopPropagation()
                      draggedNodeIdRef.current = node.id
                      isDraggingNodeRef.current = true
                    }}
                    onMouseEnter={() => {
                      setHoveredNodeId(node.id)
                      setHoveredNode(node)
                    }}
                    onMouseLeave={() => {
                      setHoveredNodeId(null)
                      setHoveredNode(null)
                    }}
                    onClick={() => {
                      if (node.type === 'video' && node.originalData?.url) {
                        window.open(node.originalData.url, '_blank')
                      }
                    }}
                  >
                    {/* Generous hit area (prevents hover flickering) */}
                    <circle
                      r={effectiveR + 10 / scaleComp}
                      fill="transparent"
                      pointerEvents="all"
                    />

                    {/* Visible node circle */}
                    <circle
                      r={effectiveR}
                      fill={node.color}
                      stroke={isHovered ? '#ffffff' : (isConnected && hoveredNodeId ? node.color : 'transparent')}
                      strokeWidth={(isHovered ? 2.5 : isConnected && hoveredNodeId ? 1.5 : 0) / strokeComp}
                      opacity={opacity}
                      filter={filterGlow}
                      style={{ transition: 'opacity 0.15s ease, stroke 0.15s ease' }}
                    />

                    {/* Labels */}
                    {node.type === 'query' && (
                      <text
                        dy={effectiveR + 12 / scaleComp}
                        textAnchor="middle"
                        fill="#ffffff"
                        opacity={opacity}
                        style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: `${labelFontSize}px`, fontWeight: 700 }}
                      >
                        TOPIC
                      </text>
                    )}
                    {node.type === 'video' && (
                      <text
                        dy={effectiveR + 12 / scaleComp}
                        textAnchor="middle"
                        fill="#888888"
                        opacity={opacity}
                        style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: `${labelFontSize}px`, fontWeight: 700 }}
                      >
                        {node.label.length > 20 ? node.label.substring(0, 18) + '...' : node.label}
                      </text>
                    )}
                    {node.type === 'concept' && (transform.k > 0.7 || isConnected) && (
                      <text
                        dy={effectiveR + 12 / scaleComp}
                        textAnchor="middle"
                        fill={isHovered || isConnected ? '#ffffff' : '#888888'}
                        opacity={opacity}
                        style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: `${labelFontSize}px`, fontWeight: 600 }}
                      >
                        {node.label.length > 20 ? node.label.substring(0, 18) + '...' : node.label}
                      </text>
                    )}
                  </g>
                )
              })}
            </g>
          </svg>

          {/* Hover Tooltip (Smooth GPU transform, zero React state re-rendering on mousemove) */}
          <div
            ref={tooltipRef}
            className={`absolute top-0 left-0 z-20 pointer-events-none rounded-xl border border-[#222222] bg-black/95 backdrop-blur-md px-4 py-3 shadow-2xl max-w-sm text-left transition-opacity duration-150 ${
              hoveredNode ? 'opacity-100' : 'opacity-0'
            }`}
            style={{ willChange: 'transform' }}
          >
            {hoveredNode && (
              <>
                {hoveredNode.type === 'query' && (
                  <div>
                    <p className="text-[9px] font-bold tracking-widest text-[#555555] uppercase mb-1">Search Topic</p>
                    <p className="text-sm font-semibold text-white leading-relaxed">{hoveredNode.label}</p>
                  </div>
                )}
                {hoveredNode.type === 'video' && hoveredNode.originalData && (
                  <div className="space-y-1.5">
                    <p className="text-[9px] font-bold tracking-widest text-[#00f0ff] uppercase">Recommended Video</p>
                    <p className="text-xs font-bold text-white line-clamp-2 leading-relaxed">
                      {(hoveredNode.originalData.title && !['none', 'null', 'n/a', ''].includes(hoveredNode.originalData.title.trim().toLowerCase()))
                        ? hoveredNode.originalData.title
                        : (hoveredNode.originalData.video_id ? `Video (${hoveredNode.originalData.video_id})` : 'Untitled Video')}
                    </p>
                    <div className="flex items-center justify-between text-[10px] text-[#666666] pt-1">
                      <span>
                        {(hoveredNode.originalData.channel && !['none', 'null', 'n/a', ''].includes(hoveredNode.originalData.channel.trim().toLowerCase()))
                          ? hoveredNode.originalData.channel
                          : ''}
                      </span>
                      {hoveredNode.originalData.overall_score && (
                        <span className="font-bold text-[#00f0ff]">
                          ★ {hoveredNode.originalData.overall_score.toFixed(1)}/10
                        </span>
                      )}
                    </div>
                    {hoveredNode.originalData.concepts_covered && hoveredNode.originalData.concepts_covered.length > 0 && (
                      <div className="pt-2 border-t border-[#1e1e1e]">
                        <p className="text-[8px] font-bold tracking-wider text-[#555555] uppercase mb-1">Key Concepts</p>
                        <div className="flex flex-wrap gap-1">
                          {hoveredNode.originalData.concepts_covered.slice(0, 3).map(c => (
                            <span key={c} className="text-[9px] px-1.5 py-0.5 bg-[#a855f7]/10 text-[#a855f7] border border-[#a855f7]/20 rounded">{c}</span>
                          ))}
                          {hoveredNode.originalData.concepts_covered.length > 3 && (
                            <span className="text-[8px] text-[#444444] self-center">+{hoveredNode.originalData.concepts_covered.length - 3} more</span>
                          )}
                        </div>
                      </div>
                    )}
                    <p className="text-[8px] text-[#444444] font-bold italic pt-1">Click to open on YouTube</p>
                  </div>
                )}
                {hoveredNode.type === 'concept' && (
                  <div>
                    <p className="text-[9px] font-bold tracking-widest text-[#a855f7] uppercase mb-1">Key Concept</p>
                    <p className="text-xs font-bold text-white leading-relaxed">{hoveredNode.label}</p>
                    <p className="text-[9px] text-[#666666] mt-1 font-semibold">
                      Covered in research results
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
