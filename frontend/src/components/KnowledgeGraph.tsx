import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { Maximize2, Minimize2, RefreshCw, Info, ZoomIn, ZoomOut, X, ExternalLink } from 'lucide-react'

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
const MIN_ZOOM = 0.2
const MAX_ZOOM = 5.0
const ZOOM_STEP = 1.25

function stripMarkdown(text?: string | null): string {
  if (!text) return ''
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/_(.*?)_/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^[#*-]\s+/gm, '')
    .trim()
}

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

  // Interaction tracking refs
  const isInteractingRef = useRef(false)
  const isPanningRef = useRef(false)
  const draggedNodeIdRef = useRef<string | null>(null)
  const dragStartPosRef = useRef({ clientX: 0, clientY: 0 })
  const dragOffsetRef = useRef({ x: 0, y: 0 })
  const panStartRef = useRef({ clientX: 0, clientY: 0, tx: 0, ty: 0 })
  const hasMovedRef = useRef(false)

  // Touch tracking (mobile pinch & pan)
  const touchesRef = useRef<{
    lastDist: number
    lastMidX: number
    lastMidY: number
    isPinching: boolean
  }>({
    lastDist: 0,
    lastMidX: 0,
    lastMidY: 0,
    isPinching: false,
  })

  // Selected & Hovered state
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)

  // Active node for detail card or tooltip
  const activeNode = useMemo(() => {
    if (selectedNode) return selectedNode
    if (hoveredNodeId) {
      return nodes.find(n => n.id === hoveredNodeId) || null
    }
    return null
  }, [selectedNode, hoveredNodeId, nodes])

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
      label: stripMarkdown(query),
      type: 'query',
      x: cx,
      y: cy,
      size: 20,
      color: '#ffffff',
    })

    // 2. Video Nodes (Inner Circle)
    const numVideos = resources.length
    const videoAngles = new Map<string, number>()
    const rVideoX = 145
    const rVideoY = 115

    resources.forEach((res, i) => {
      const angle = numVideos > 0 ? (i / numVideos) * Math.PI * 2 - Math.PI / 2 : 0
      const vid = `video_${res.video_id}`
      videoAngles.set(vid, angle)

      const rawTitle = (res.title && !['none', 'null', 'n/a', ''].includes(res.title.trim().toLowerCase()))
        ? res.title
        : (res.video_id ? `Video (${res.video_id})` : 'Untitled Video')
      const cleanTitle = stripMarkdown(rawTitle)

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
        const clean = stripMarkdown(concept)
        if (!clean) return
        if (!conceptToVideos.has(clean)) conceptToVideos.set(clean, [])
        conceptToVideos.get(clean)!.push(vid)
      })
    })

    topics.forEach(topic => {
      const clean = stripMarkdown(topic)
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
    const rConceptX = 280
    const rConceptY = 180

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
    setSelectedNode(null)
  }, [query, resources, topics, setTransform])

  // Stable key representing the underlying dataset identity
  const datasetFingerprint = useMemo(() => {
    const vIds = resources.map(r => r.video_id).sort().join(',')
    const topStr = [...topics].sort().join(',')
    return `${query}___${vIds}___${topStr}`
  }, [query, resources, topics])

  const initializedFingerprintRef = useRef<string | null>(null)

  // Initialize/rebuild layout ONLY when the underlying video/topic dataset genuinely changes
  useEffect(() => {
    if (initializedFingerprintRef.current !== datasetFingerprint) {
      initializedFingerprintRef.current = datasetFingerprint
      buildLayout()
    }
  }, [datasetFingerprint, buildLayout])

  // --- 2. Screen to ViewBox Coordinate Transformation ---
  const clientToVB = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current
    if (!svg) return { vx: VB_W / 2, vy: VB_H / 2 }

    try {
      const ctm = svg.getScreenCTM()
      if (ctm) {
        const pt = svg.createSVGPoint()
        pt.x = clientX
        pt.y = clientY
        const res = pt.matrixTransform(ctm.inverse())
        if (Number.isFinite(res.x) && Number.isFinite(res.y)) {
          return { vx: res.x, vy: res.y }
        }
      }
    } catch {
      // Fallback below
    }

    // High-precision fallback accounting for preserveAspectRatio="xMidYMid meet"
    const rect = svg.getBoundingClientRect()
    if (!rect.width || !rect.height) return { vx: VB_W / 2, vy: VB_H / 2 }

    const scale = Math.min(rect.width / VB_W, rect.height / VB_H)
    const offsetX = (rect.width - VB_W * scale) / 2
    const offsetY = (rect.height - VB_H * scale) / 2

    const vx = (clientX - rect.left - offsetX) / scale
    const vy = (clientY - rect.top - offsetY) / scale
    return { vx, vy }
  }, [])

  // --- 3. Screen to Graph Coordinate Transformation ---
  const clientToGraph = useCallback(
    (clientX: number, clientY: number) => {
      const { vx, vy } = clientToVB(clientX, clientY)
      const cur = transformRef.current
      const gx = (vx - cur.x) / cur.k
      const gy = (vy - cur.y) / cur.k
      return { gx, gy, vx, vy }
    },
    [clientToVB]
  )

  // --- 4. Zoom Anchored at ViewBox Point (vx, vy) ---
  const zoomAt = useCallback(
    (vx: number, vy: number, factor: number) => {
      setTransform(prev => {
        const nextK = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev.k * factor))
        if (Math.abs(nextK - prev.k) < 1e-4) return prev
        const scale = nextK / prev.k
        return {
          x: vx - (vx - prev.x) * scale,
          y: vy - (vy - prev.y) * scale,
          k: nextK,
        }
      })
    },
    [setTransform]
  )

  // --- 5. Mouse Wheel & Ctrl+Wheel Handler (Smooth, Highly Responsive) ---
  useEffect(() => {
    const container = containerRef.current
    if (!container || !isOpen) return

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      e.stopPropagation()

      if (Math.abs(e.deltaY) < 1e-4 && Math.abs(e.deltaX) < 1e-4) return

      let dy = e.deltaY
      if (e.deltaMode === 1) dy *= 16
      else if (e.deltaMode === 2) dy *= 40

      let factor: number
      if (Math.abs(dy) >= 40) {
        // Discrete mouse wheel notch (standard on desktop with wheel or Ctrl+wheel)
        factor = dy < 0 ? 1.15 : 0.87
      } else {
        // Continuous trackpad pinch or high-precision scroll
        const clamped = Math.max(-50, Math.min(50, dy))
        const sensitivity = e.ctrlKey ? 0.005 : 0.003
        factor = Math.exp(-clamped * sensitivity)
      }

      const { vx, vy } = clientToVB(e.clientX, e.clientY)
      zoomAt(vx, vy, factor)
    }

    container.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      container.removeEventListener('wheel', onWheel)
    }
  }, [clientToVB, zoomAt, isOpen])

  // --- 6. Robust Pointer/Mouse Events for Canvas Pan & Node Dragging ---
  useEffect(() => {
    const handleWindowPointerMove = (e: PointerEvent) => {
      // 1. Move tooltip smoothly via direct DOM transform (zero React re-renders)
      if (tooltipRef.current && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        const x = Math.min(rect.width - 290, Math.max(12, e.clientX - rect.left + 16))
        const y = Math.min(rect.height - 180, Math.max(12, e.clientY - rect.top + 16))
        tooltipRef.current.style.transform = `translate3d(${x}px, ${y}px, 0)`
      }

      if (!isInteractingRef.current) return

      const moveDist = Math.hypot(
        e.clientX - dragStartPosRef.current.clientX,
        e.clientY - dragStartPosRef.current.clientY
      )
      if (moveDist > 4) {
        hasMovedRef.current = true
      }

      // 2. Drag individual node
      if (draggedNodeIdRef.current) {
        const { gx, gy } = clientToGraph(e.clientX, e.clientY)
        const targetX = gx - dragOffsetRef.current.x
        const targetY = gy - dragOffsetRef.current.y

        setNodes(prev =>
          prev.map(node =>
            node.id === draggedNodeIdRef.current
              ? { ...node, x: targetX, y: targetY }
              : node
          )
        )
        return
      }

      // 3. Pan Canvas
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

    const handleWindowPointerUp = () => {
      if (!isInteractingRef.current) return
      isInteractingRef.current = false
      isPanningRef.current = false
      draggedNodeIdRef.current = null
      hasMovedRef.current = false
    }

    window.addEventListener('pointermove', handleWindowPointerMove, { passive: true })
    window.addEventListener('pointerup', handleWindowPointerUp, { passive: true })
    window.addEventListener('pointercancel', handleWindowPointerUp, { passive: true })

    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove)
      window.removeEventListener('pointerup', handleWindowPointerUp)
      window.removeEventListener('pointercancel', handleWindowPointerUp)
    }
  }, [clientToGraph, setTransform])

  // Mouse / Pointer Down on Canvas (Pan starts)
  const handleCanvasPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return // Left click only

    isInteractingRef.current = true
    isPanningRef.current = true
    draggedNodeIdRef.current = null
    hasMovedRef.current = false
    dragStartPosRef.current = { clientX: e.clientX, clientY: e.clientY }
    panStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      tx: transformRef.current.x,
      ty: transformRef.current.y,
    }
  }

  // Pointer Down on a specific Node (Drag starts)
  const handleNodePointerDown = (e: React.PointerEvent, node: Node) => {
    e.stopPropagation()
    if (e.button !== 0) return

    isInteractingRef.current = true
    isPanningRef.current = false
    draggedNodeIdRef.current = node.id
    hasMovedRef.current = false
    dragStartPosRef.current = { clientX: e.clientX, clientY: e.clientY }

    const { gx, gy } = clientToGraph(e.clientX, e.clientY)
    dragOffsetRef.current = {
      x: gx - node.x,
      y: gy - node.y,
    }
  }

  // Handle Clean Click / Tap on Node (distinguish drag from click)
  const handleNodeClick = (e: React.MouseEvent, node: Node) => {
    e.stopPropagation()
    if (hasMovedRef.current) return // It was a drag, not a click

    setSelectedNode(prev => (prev?.id === node.id ? null : node))

    // If video node clicked, open link on double-click or external action
    if (node.type === 'video' && node.originalData?.url) {
      // Keep selected for mobile, open tab on desktop if already selected
      if (selectedNode?.id === node.id) {
        window.open(node.originalData.url, '_blank')
      }
    }
  }

  // Double Click Canvas to Zoom In
  const handleCanvasDoubleClick = (e: React.MouseEvent) => {
    const { vx, vy } = clientToVB(e.clientX, e.clientY)
    zoomAt(vx, vy, 1.4)
  }

  // --- 7. Native Mobile Touch Handlers (Pinch Zoom & Smooth 1/2-Finger Pan) ---
  useEffect(() => {
    const container = containerRef.current
    if (!container || !isOpen) return

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault()
        const [t0, t1] = [e.touches[0], e.touches[1]]
        const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY)
        const midX = (t0.clientX + t1.clientX) / 2
        const midY = (t0.clientY + t1.clientY) / 2

        touchesRef.current = {
          lastDist: dist,
          lastMidX: midX,
          lastMidY: midY,
          isPinching: true,
        }
        isPanningRef.current = false
        draggedNodeIdRef.current = null
      } else if (e.touches.length === 1) {
        const t = e.touches[0]
        touchesRef.current.isPinching = false
        panStartRef.current = {
          clientX: t.clientX,
          clientY: t.clientY,
          tx: transformRef.current.x,
          ty: transformRef.current.y,
        }
        dragStartPosRef.current = { clientX: t.clientX, clientY: t.clientY }
        hasMovedRef.current = false
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      // Always prevent default native touch behaviors (pull-to-refresh, page zoom)
      e.preventDefault()

      // 2-finger Pinch to Zoom & Pan simultaneously
      if (e.touches.length === 2 && touchesRef.current.isPinching) {
        const [t0, t1] = [e.touches[0], e.touches[1]]
        const newDist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY)
        const newMidX = (t0.clientX + t1.clientX) / 2
        const newMidY = (t0.clientY + t1.clientY) / 2

        if (touchesRef.current.lastDist > 10 && newDist > 10) {
          const factor = Math.max(0.85, Math.min(1.15, newDist / touchesRef.current.lastDist))
          const { vx, vy } = clientToVB(newMidX, newMidY)
          zoomAt(vx, vy, factor)

          // 2-finger pan delta
          if (svgRef.current) {
            const rect = svgRef.current.getBoundingClientRect()
            const scaleX = VB_W / (rect.width || 1)
            const scaleY = VB_H / (rect.height || 1)
            const deltaMidX = (newMidX - touchesRef.current.lastMidX) * scaleX
            const deltaMidY = (newMidY - touchesRef.current.lastMidY) * scaleY

            setTransform(prev => ({
              k: prev.k,
              x: prev.x + deltaMidX,
              y: prev.y + deltaMidY,
            }))
          }

          touchesRef.current.lastDist = newDist
          touchesRef.current.lastMidX = newMidX
          touchesRef.current.lastMidY = newMidY
        }
        return
      }

      // 1-finger drag node or pan canvas
      if (e.touches.length === 1 && !touchesRef.current.isPinching) {
        const t = e.touches[0]
        const moveDist = Math.hypot(
          t.clientX - dragStartPosRef.current.clientX,
          t.clientY - dragStartPosRef.current.clientY
        )
        if (moveDist > 4) {
          hasMovedRef.current = true
        }

        if (draggedNodeIdRef.current) {
          const { gx, gy } = clientToGraph(t.clientX, t.clientY)
          const targetX = gx - dragOffsetRef.current.x
          const targetY = gy - dragOffsetRef.current.y

          setNodes(prev =>
            prev.map(node =>
              node.id === draggedNodeIdRef.current
                ? { ...node, x: targetX, y: targetY }
                : node
            )
          )
        } else if (svgRef.current) {
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

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 0) {
        touchesRef.current.isPinching = false
        isPanningRef.current = false
        draggedNodeIdRef.current = null
      } else if (e.touches.length === 1) {
        touchesRef.current.isPinching = false
        const t = e.touches[0]
        panStartRef.current = {
          clientX: t.clientX,
          clientY: t.clientY,
          tx: transformRef.current.x,
          ty: transformRef.current.y,
        }
      }
    }

    container.addEventListener('touchstart', onTouchStart, { passive: false })
    container.addEventListener('touchmove', onTouchMove, { passive: false })
    container.addEventListener('touchend', onTouchEnd, { passive: false })
    container.addEventListener('touchcancel', onTouchEnd, { passive: false })

    return () => {
      container.removeEventListener('touchstart', onTouchStart)
      container.removeEventListener('touchmove', onTouchMove)
      container.removeEventListener('touchend', onTouchEnd)
      container.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [clientToVB, clientToGraph, zoomAt, setTransform, isOpen])

  // --- 8. Button Handlers ---
  const handleZoomIn = () => zoomAt(VB_W / 2, VB_H / 2, ZOOM_STEP)
  const handleZoomOut = () => zoomAt(VB_W / 2, VB_H / 2, 1 / ZOOM_STEP)
  const handleReset = () => {
    buildLayout()
    setSelectedNode(null)
  }

  // --- 9. Highlight Determination ---
  const highlightedNodeId = selectedNode?.id || hoveredNodeId

  const connectedNodeIds = useMemo(() => {
    if (!highlightedNodeId) return new Set<string>()
    const set = new Set<string>()
    set.add(highlightedNodeId)
    links.forEach(l => {
      if (l.source === highlightedNodeId) set.add(l.target)
      if (l.target === highlightedNodeId) set.add(l.source)
    })
    return set
  }, [highlightedNodeId, links])

  const connectedLinkKeys = useMemo(() => {
    if (!highlightedNodeId) return new Set<string>()
    const set = new Set<string>()
    links.forEach(l => {
      if (l.source === highlightedNodeId || l.target === highlightedNodeId) {
        set.add(`${l.source}-${l.target}`)
      }
    })
    return set
  }, [highlightedNodeId, links])

  // Scale compensation so elements look balanced at any zoom level
  const scaleComp = Math.pow(transform.k, 0.35)
  const strokeComp = Math.pow(transform.k, 0.45)

  // Map for fast node coordinate lookup
  const nodeMap = useMemo(() => {
    const map = new Map<string, Node>()
    nodes.forEach(n => map.set(n.id, n))
    return map
  }, [nodes])

  return (
    <div className="border border-[#222222] bg-[#111111]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#1c1c1c] px-4 sm:px-6 py-3.5">
        <div className="flex items-center gap-2">
          <Info size={14} className="text-[#555555]" />
          <span className="text-[10px] sm:text-xs font-bold tracking-[0.2em] text-[#888888] uppercase">
            Interactive Video Knowledge Graph
          </span>
        </div>
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            onClick={handleReset}
            title="Reset layout & zoom (100%)"
            className="flex items-center gap-1.5 text-[10px] font-bold text-[#666666] hover:text-white transition-colors uppercase tracking-wider py-1 px-1.5 rounded active:scale-95"
          >
            <RefreshCw size={11} /> Reset
          </button>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="text-[10px] font-bold text-[#666666] hover:text-white transition-colors uppercase tracking-wider py-1 px-1.5 rounded active:scale-95"
          >
            {isOpen ? 'Collapse' : 'Expand'}
          </button>
        </div>
      </div>

      {/* Graph Container */}
      {isOpen && (
        <div
          ref={containerRef}
          onPointerDown={handleCanvasPointerDown}
          onDoubleClick={handleCanvasDoubleClick}
          className={`relative overflow-hidden bg-black select-none touch-none cursor-grab active:cursor-grabbing ${
            isFullscreen
              ? 'fixed inset-0 z-50 h-screen w-screen'
              : 'h-[400px] sm:h-[480px] md:h-[520px] w-full'
          }`}
          style={{ touchAction: 'none' }}
        >
          {/* Legend */}
          <div className="absolute left-3 sm:left-4 top-3 sm:top-4 z-10 flex flex-wrap items-center gap-2.5 sm:gap-4 text-[9px] text-[#555555] font-bold tracking-wider uppercase bg-[#111111]/85 backdrop-blur-md px-2.5 sm:px-3 py-1.5 rounded-lg border border-[#222222]/60 pointer-events-none">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.7)]" /> Topic
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#00f0ff] shadow-[0_0_8px_rgba(0,240,255,0.7)]" /> Videos
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#a855f7] shadow-[0_0_8px_rgba(168,85,247,0.7)]" /> Concepts
            </div>
            <div className="hidden md:inline-block ml-1 text-[8px] text-[#444444] border-l border-[#222222] pl-2.5">
              Scroll / Ctrl+Scroll / Pinch to Zoom • Drag to Pan
            </div>
          </div>

          {/* Zoom % badge */}
          <div className="absolute left-3 sm:left-4 bottom-3 sm:bottom-4 z-10 text-[10px] font-mono text-[#777777] bg-[#111111]/85 backdrop-blur-md px-2.5 py-1 rounded-md border border-[#222222]/60 pointer-events-none select-none">
            {Math.round(transform.k * 100)}%
          </div>

          {/* Floating Controls */}
          <div className="absolute right-3 sm:right-4 bottom-3 sm:bottom-4 z-10 flex flex-col gap-1.5 sm:gap-2">
            <button
              onClick={handleZoomIn}
              title="Zoom in (+)"
              className="flex h-9 w-9 sm:h-8 sm:w-8 items-center justify-center border border-[#222222] bg-[#111111]/85 backdrop-blur-md text-[#cccccc] hover:border-[#555555] hover:text-white transition-colors rounded-lg shadow-lg active:scale-90"
            >
              <ZoomIn size={15} />
            </button>
            <button
              onClick={handleZoomOut}
              title="Zoom out (-)"
              className="flex h-9 w-9 sm:h-8 sm:w-8 items-center justify-center border border-[#222222] bg-[#111111]/85 backdrop-blur-md text-[#cccccc] hover:border-[#555555] hover:text-white transition-colors rounded-lg shadow-lg active:scale-90"
            >
              <ZoomOut size={15} />
            </button>
            <button
              onClick={handleReset}
              title="Fit / Reset (100%)"
              className="flex h-9 w-9 sm:h-8 sm:w-8 items-center justify-center border border-[#222222] bg-[#111111]/85 backdrop-blur-md text-[#cccccc] hover:border-[#555555] hover:text-white transition-colors rounded-lg shadow-lg active:scale-90"
            >
              <RefreshCw size={13} />
            </button>
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              className="flex h-9 w-9 sm:h-8 sm:w-8 items-center justify-center border border-[#222222] bg-[#111111]/85 backdrop-blur-md text-[#cccccc] hover:border-[#555555] hover:text-white transition-colors rounded-lg shadow-lg active:scale-90"
            >
              {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>
          </div>

          {/* SVG Canvas */}
          <svg
            ref={svgRef}
            viewBox={`0 0 ${VB_W} ${VB_H}`}
            preserveAspectRatio="xMidYMid meet"
            className="h-full w-full pointer-events-auto"
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

                const isHighlight = highlightedNodeId ? connectedLinkKeys.has(`${link.source}-${link.target}`) : false
                const isDimmed = highlightedNodeId ? !isHighlight : false

                return (
                  <line
                    key={`link-${i}`}
                    x1={s.x}
                    y1={s.y}
                    x2={t.x}
                    y2={t.y}
                    stroke={isHighlight ? (t.type === 'concept' ? '#a855f7' : '#00f0ff') : '#222222'}
                    strokeWidth={(isHighlight ? 2.0 : 1.0) / strokeComp}
                    opacity={isDimmed ? 0.08 : (isHighlight ? 0.95 : 0.45)}
                    style={{ transition: 'stroke 0.15s ease, opacity 0.15s ease' }}
                  />
                )
              })}

              {/* Nodes */}
              {nodes.map(node => {
                const isNodeSelected = selectedNode?.id === node.id
                const isNodeHovered = hoveredNodeId === node.id
                const isHighlighted = isNodeSelected || isNodeHovered
                const isConnected = highlightedNodeId ? connectedNodeIds.has(node.id) : true
                const isDimmed = highlightedNodeId ? !isConnected : false
                const opacity = isDimmed ? 0.15 : 1

                const filterGlow = node.type === 'video'
                  ? 'url(#glow-video)'
                  : node.type === 'concept' ? 'url(#glow-concept)' : undefined

                const effectiveR = node.size / scaleComp
                const labelFontSize = Math.max(7.5, Math.min(11.0, 9.0 / scaleComp))

                return (
                  <g
                    key={node.id}
                    transform={`translate(${node.x},${node.y})`}
                    className="cursor-pointer"
                    onPointerDown={e => handleNodePointerDown(e, node)}
                    onClick={e => handleNodeClick(e, node)}
                    onMouseEnter={() => setHoveredNodeId(node.id)}
                    onMouseLeave={() => setHoveredNodeId(null)}
                  >
                    {/* Generous hit area (prevents touch/hover flickering) */}
                    <circle
                      r={effectiveR + 12 / scaleComp}
                      fill="transparent"
                      pointerEvents="all"
                    />

                    {/* Visible node circle */}
                    <circle
                      r={effectiveR}
                      fill={node.color}
                      stroke={isHighlighted ? '#ffffff' : (isConnected && highlightedNodeId ? node.color : 'transparent')}
                      strokeWidth={(isHighlighted ? 2.5 : isConnected && highlightedNodeId ? 1.5 : 0) / strokeComp}
                      opacity={opacity}
                      filter={filterGlow}
                      style={{ transition: 'opacity 0.15s ease, stroke 0.15s ease, transform 0.15s ease' }}
                    />

                    {/* Node Selection Ring */}
                    {isNodeSelected && (
                      <circle
                        r={effectiveR + 4 / scaleComp}
                        fill="none"
                        stroke="#00f0ff"
                        strokeWidth={1.5 / strokeComp}
                        strokeDasharray="3 3"
                        opacity={0.9}
                      />
                    )}

                    {/* Labels */}
                    {node.type === 'query' && (
                      <text
                        dy={effectiveR + 13 / scaleComp}
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
                        dy={effectiveR + 13 / scaleComp}
                        textAnchor="middle"
                        fill="#999999"
                        opacity={opacity}
                        style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: `${labelFontSize}px`, fontWeight: 700 }}
                      >
                        {node.label.length > 20 ? node.label.substring(0, 18) + '...' : node.label}
                      </text>
                    )}
                    {node.type === 'concept' && (transform.k > 0.6 || isConnected) && (
                      <text
                        dy={effectiveR + 13 / scaleComp}
                        textAnchor="middle"
                        fill={isHighlighted || isConnected ? '#ffffff' : '#888888'}
                        opacity={opacity}
                        style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: `${labelFontSize}px`, fontWeight: 600 }}
                      >
                        {node.label.length > 22 ? node.label.substring(0, 20) + '...' : node.label}
                      </text>
                    )}
                  </g>
                )
              })}
            </g>
          </svg>

          {/* Floating Hover Tooltip for Desktop */}
          <div
            ref={tooltipRef}
            className={`absolute top-0 left-0 z-20 pointer-events-none rounded-xl border border-[#222222] bg-black/95 backdrop-blur-md px-4 py-3 shadow-2xl max-w-sm text-left transition-opacity duration-150 hidden sm:block ${
              hoveredNodeId && !selectedNode ? 'opacity-100' : 'opacity-0'
            }`}
            style={{ willChange: 'transform' }}
          >
            {activeNode && !selectedNode && (
              <>
                {activeNode.type === 'query' && (
                  <div>
                    <p className="text-[9px] font-bold tracking-widest text-[#555555] uppercase mb-1">Search Topic</p>
                    <p className="text-sm font-semibold text-white leading-relaxed">{activeNode.label}</p>
                  </div>
                )}
                {activeNode.type === 'video' && activeNode.originalData && (
                  <div className="space-y-1.5">
                    <p className="text-[9px] font-bold tracking-widest text-[#00f0ff] uppercase">Recommended Video</p>
                    <p className="text-xs font-bold text-white line-clamp-2 leading-relaxed">
                      {(activeNode.originalData.title && !['none', 'null', 'n/a', ''].includes(activeNode.originalData.title.trim().toLowerCase()))
                        ? activeNode.originalData.title
                        : (activeNode.originalData.video_id ? `Video (${activeNode.originalData.video_id})` : 'Untitled Video')}
                    </p>
                    <div className="flex items-center justify-between text-[10px] text-[#666666] pt-1">
                      <span>{activeNode.originalData.channel || ''}</span>
                      {activeNode.originalData.overall_score && (
                        <span className="font-bold text-[#00f0ff]">
                          ★ {activeNode.originalData.overall_score.toFixed(1)}/10
                        </span>
                      )}
                    </div>
                    {activeNode.originalData.concepts_covered && activeNode.originalData.concepts_covered.length > 0 && (
                      <div className="pt-2 border-t border-[#1e1e1e]">
                        <p className="text-[8px] font-bold tracking-wider text-[#555555] uppercase mb-1">Key Concepts</p>
                        <div className="flex flex-wrap gap-1">
                          {activeNode.originalData.concepts_covered.slice(0, 3).map(c => (
                            <span key={c} className="text-[9px] px-1.5 py-0.5 bg-[#a855f7]/10 text-[#a855f7] border border-[#a855f7]/20 rounded">{c}</span>
                          ))}
                          {activeNode.originalData.concepts_covered.length > 3 && (
                            <span className="text-[8px] text-[#444444] self-center">+{activeNode.originalData.concepts_covered.length - 3} more</span>
                          )}
                        </div>
                      </div>
                    )}
                    <p className="text-[8px] text-[#555555] font-bold italic pt-1">Click node to select / view</p>
                  </div>
                )}
                {activeNode.type === 'concept' && (
                  <div>
                    <p className="text-[9px] font-bold tracking-widest text-[#a855f7] uppercase mb-1">Key Concept</p>
                    <p className="text-xs font-bold text-white leading-relaxed">{activeNode.label}</p>
                    <p className="text-[9px] text-[#666666] mt-1 font-semibold">
                      Covered in curriculum analysis
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Persistent Selected Node Detail Card (Perfect for Mobile Tap & Desktop Selection) */}
          {selectedNode && (
            <div className="absolute left-3 right-3 sm:left-4 sm:right-auto sm:max-w-md bottom-14 sm:bottom-4 z-30 rounded-xl border border-[#333333] bg-[#0c0c0c]/95 backdrop-blur-xl p-3.5 sm:p-4 shadow-2xl text-left animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="flex items-start justify-between gap-3 mb-1.5">
                <span className={`text-[9px] font-bold tracking-widest uppercase ${
                  selectedNode.type === 'video' ? 'text-[#00f0ff]' : selectedNode.type === 'concept' ? 'text-[#a855f7]' : 'text-white'
                }`}>
                  {selectedNode.type === 'video' ? 'Selected Video' : selectedNode.type === 'concept' ? 'Selected Concept' : 'Search Topic'}
                </span>
                <button
                  onClick={() => setSelectedNode(null)}
                  title="Close"
                  className="text-[#666666] hover:text-white p-1 rounded-md transition-colors"
                >
                  <X size={14} />
                </button>
              </div>

              <p className="text-xs sm:text-sm font-bold text-white leading-snug line-clamp-2">
                {stripMarkdown(selectedNode.originalData?.title || selectedNode.label)}
              </p>

              {selectedNode.type === 'video' && selectedNode.originalData && (
                <div className="mt-2 space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-[#888888]">
                    <span>{stripMarkdown(selectedNode.originalData.channel || 'YouTube Video')}</span>
                    {selectedNode.originalData.overall_score && (
                      <span className="font-bold text-[#00f0ff] bg-[#00f0ff]/10 px-2 py-0.5 rounded border border-[#00f0ff]/20">
                        ★ {selectedNode.originalData.overall_score.toFixed(1)}/10
                      </span>
                    )}
                  </div>

                  {selectedNode.originalData.concepts_covered && selectedNode.originalData.concepts_covered.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {selectedNode.originalData.concepts_covered.slice(0, 5).map(c => (
                        <span key={c} className="text-[9px] px-1.5 py-0.5 bg-[#a855f7]/15 text-[#c084fc] border border-[#a855f7]/30 rounded">
                          {stripMarkdown(c)}
                        </span>
                      ))}
                    </div>
                  )}

                  {selectedNode.originalData.url && (
                    <a
                      href={selectedNode.originalData.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-black bg-[#00f0ff] hover:bg-[#38bdf8] px-3 py-1.5 rounded-lg transition-colors mt-1"
                    >
                      <ExternalLink size={13} /> Watch on YouTube
                    </a>
                  )}
                </div>
              )}

              {selectedNode.type === 'concept' && (
                <p className="text-[10px] text-[#888888] mt-1.5">
                  Highlighted lines connect this concept to all recommended course videos covering it.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

