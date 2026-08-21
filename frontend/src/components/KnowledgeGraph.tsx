import React, { useEffect, useRef, useState } from 'react'
import { Maximize2, Minimize2, RefreshCw, Info } from 'lucide-react'

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
  vx: number
  vy: number
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

export default function KnowledgeGraph({ query, resources, topics }: KnowledgeGraphProps) {
  const [isOpen, setIsOpen] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Transform for Pan & Zoom
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })

  // Simulation Refs & States
  const nodesRef = useRef<Node[]>([])
  const linksRef = useRef<Link[]>([])
  const [nodes, setNodes] = useState<Node[]>([])
  const [links, setLinks] = useState<Link[]>([])
  const [tick, setTick] = useState(0)

  // Interactivity
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null)
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
  const [hoveredNode, setHoveredNode] = useState<Node | null>(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })

  const width = 800
  const height = 450

  // 1. Initialize Nodes & Links
  useEffect(() => {
    if (!query) return

    const newNodes: Node[] = []
    const newLinks: Link[] = []

    // Central Query Node
    newNodes.push({
      id: 'query',
      label: query,
      type: 'query',
      x: width / 2,
      y: height / 2,
      vx: 0,
      vy: 0,
      size: 20,
      color: '#ffffff'
    })

    // Video Nodes
    resources.forEach((res, index) => {
      const angle = (index / resources.length) * Math.PI * 2
      const radius = 110
      const x = width / 2 + Math.cos(angle) * radius + (Math.random() - 0.5) * 15
      const y = height / 2 + Math.sin(angle) * radius + (Math.random() - 0.5) * 15
      
      const nodeId = `video_${res.video_id}`
      newNodes.push({
        id: nodeId,
        label: res.title || 'Untitled Video',
        type: 'video',
        x,
        y,
        vx: 0,
        vy: 0,
        size: 14,
        color: '#00f0ff', // Cyan glow
        originalData: res
      })

      newLinks.push({ source: 'query', target: nodeId })
    })

    // Concept Nodes
    const allConcepts = new Set<string>()
    resources.forEach(res => {
      if (res.concepts_covered) {
        res.concepts_covered.forEach(c => {
          if (c) allConcepts.add(c)
        })
      }
    })
    topics.forEach(t => {
      if (t) allConcepts.add(t)
    })

    const conceptArray = Array.from(allConcepts)
    conceptArray.forEach((concept, index) => {
      const angle = (index / conceptArray.length) * Math.PI * 2
      const radius = 200
      const x = width / 2 + Math.cos(angle) * radius + (Math.random() - 0.5) * 15
      const y = height / 2 + Math.sin(angle) * radius + (Math.random() - 0.5) * 15
      
      const nodeId = `concept_${concept}`
      newNodes.push({
        id: nodeId,
        label: concept,
        type: 'concept',
        x,
        y,
        vx: 0,
        vy: 0,
        size: 8,
        color: '#a855f7' // Purple glow
      })

      resources.forEach(res => {
        if (res.concepts_covered && res.concepts_covered.includes(concept)) {
          newLinks.push({ source: `video_${res.video_id}`, target: nodeId })
        }
      })
    })

    nodesRef.current = newNodes
    linksRef.current = newLinks
    setNodes(newNodes)
    setLinks(newLinks)
    setTransform({ x: 0, y: 0, k: 1 })
  }, [query, resources, topics])

  // 2. Simulation Loop (Physics)
  useEffect(() => {
    let animId: number
    
    const runSimulation = () => {
      const currentNodes = nodesRef.current
      const currentLinks = linksRef.current
      if (currentNodes.length === 0) {
        animId = requestAnimationFrame(runSimulation)
        return
      }

      const nodeMap: Record<string, Node> = {}
      currentNodes.forEach(n => { nodeMap[n.id] = n })

      // Repulsion between all node pairs
      for (let i = 0; i < currentNodes.length; i++) {
        const n1 = currentNodes[i]
        for (let j = i + 1; j < currentNodes.length; j++) {
          const n2 = currentNodes[j]
          
          const dx = n2.x - n1.x
          const dy = n2.y - n1.y
          const distSq = dx * dx + dy * dy || 1
          const dist = Math.sqrt(distSq)
          
          const minDist = n1.type === 'query' || n2.type === 'query' ? 140 : 80
          if (dist < minDist) {
            const force = ((minDist * minDist) / distSq) * 0.12
            const fx = (dx / dist) * force
            const fy = (dy / dist) * force
            
            if (n1.id !== draggedNodeId) {
              n1.vx -= fx
              n1.vy -= fy
            }
            if (n2.id !== draggedNodeId) {
              n2.vx += fx
              n2.vy += fy
            }
          }
        }
      }

      // Link attraction (Hooke's law)
      for (const link of currentLinks) {
        const s = nodeMap[link.source]
        const t = nodeMap[link.target]
        if (!s || !t) continue
        
        const dx = t.x - s.x
        const dy = t.y - s.y
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        
        let restLength = 100
        if (s.type === 'query' || t.type === 'query') restLength = 70
        
        const force = (dist - restLength) * 0.02
        const fx = (dx / dist) * force
        const fy = (dy / dist) * force
        
        if (s.id !== draggedNodeId) {
          s.vx += fx
          s.vy += fy
        }
        if (t.id !== draggedNodeId) {
          t.vx -= fx
          t.vy -= fy
        }
      }

      // Pull to center & Damping
      const centerX = width / 2
      const centerY = height / 2
      for (const n of currentNodes) {
        if (n.id === draggedNodeId) continue
        
        const dx = centerX - n.x
        const dy = centerY - n.y
        n.vx += dx * 0.005
        n.vy += dy * 0.005
        
        n.vx *= 0.82
        n.vy *= 0.82
        
        n.x += n.vx
        n.y += n.vy
      }

      setTick(t => t + 1)
      animId = requestAnimationFrame(runSimulation)
    }

    animId = requestAnimationFrame(runSimulation)
    return () => cancelAnimationFrame(animId)
  }, [draggedNodeId])

  // Coordinate Conversion (Screen space -> SVG space)
  const getSVGCoords = (clientX: number, clientY: number) => {
    if (!svgRef.current) return { x: 0, y: 0 }
    const rect = svgRef.current.getBoundingClientRect()
    const x = clientX - rect.left
    const y = clientY - rect.top
    return {
      x: (x - transform.x) / transform.k,
      y: (y - transform.y) / transform.k
    }
  }

  // Mouse drag handler for nodes
  const handleNodeMouseDown = (e: React.MouseEvent, node: Node) => {
    e.stopPropagation()
    setDraggedNodeId(node.id)
    node.vx = 0
    node.vy = 0
  }

  // Main SVG Interaction Handlers
  const handleSVGMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return // Left click only
    setIsPanning(true)
    setPanStart({ x: e.clientX - transform.x, y: e.clientY - transform.y })
  }

  const handleSVGMouseMove = (e: React.MouseEvent) => {
    const coords = getSVGCoords(e.clientX, e.clientY)

    if (draggedNodeId) {
      const node = nodesRef.current.find(n => n.id === draggedNodeId)
      if (node) {
        node.x = coords.x
        node.y = coords.y
        node.vx = 0
        node.vy = 0
        setTick(t => t + 1)
      }
    } else if (isPanning) {
      setTransform(t => ({
        ...t,
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      }))
    }

    // Move tooltip if hovering
    if (hoveredNodeId) {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        setTooltipPos({
          x: e.clientX - rect.left + 15,
          y: e.clientY - rect.top + 15
        })
      }
    }
  }

  const handleSVGMouseUp = () => {
    setDraggedNodeId(null)
    setIsPanning(false)
  }

  // --- Mobile Touch Screen Interaction Handlers ---
  const getSVGTouchCoords = (clientX: number, clientY: number) => {
    if (!svgRef.current) return { x: 0, y: 0 }
    const rect = svgRef.current.getBoundingClientRect()
    const x = clientX - rect.left
    const y = clientY - rect.top
    return {
      x: (x - transform.x) / transform.k,
      y: (y - transform.y) / transform.k
    }
  }

  const handleNodeTouchStart = (e: React.TouchEvent, node: Node) => {
    e.stopPropagation() // Prevent background panning
    setDraggedNodeId(node.id)
    node.vx = 0
    node.vy = 0
  }

  const handleSVGTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return // Only handle single-finger pans
    const touch = e.touches[0]
    setIsPanning(true)
    setPanStart({ x: touch.clientX - transform.x, y: touch.clientY - transform.y })
  }

  const handleSVGTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return
    const touch = e.touches[0]
    const coords = getSVGTouchCoords(touch.clientX, touch.clientY)

    if (draggedNodeId) {
      if (e.cancelable) e.preventDefault() // Block browser scroll during drag
      const node = nodesRef.current.find(n => n.id === draggedNodeId)
      if (node) {
        node.x = coords.x
        node.y = coords.y
        node.vx = 0
        node.vy = 0
        setTick(t => t + 1)
      }
    } else if (isPanning) {
      if (e.cancelable) e.preventDefault() // Block browser scroll during pan
      setTransform(t => ({
        ...t,
        x: touch.clientX - panStart.x,
        y: touch.clientY - panStart.y
      }))
    }
  }

  const handleSVGTouchEnd = () => {
    setDraggedNodeId(null)
    setIsPanning(false)
  }

  // Zooming via Native Non-Passive Event Listener (prevents page scroll and allows zooming over nodes)
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const handleNativeWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = 1.08;
      
      setTransform(prev => {
        const nextK = e.deltaY < 0 ? prev.k * zoomFactor : prev.k / zoomFactor;
        const boundedK = Math.max(0.15, Math.min(3, nextK));
        
        const rect = svg.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const dx = mouseX - prev.x;
        const dy = mouseY - prev.y;
        
        return {
          x: mouseX - dx * (boundedK / prev.k),
          y: mouseY - dy * (boundedK / prev.k),
          k: boundedK
        };
      });
    };

    svg.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => {
      svg.removeEventListener('wheel', handleNativeWheel);
    };
  }, []);

  // Highlight connection state helper
  const getHighlightState = (nodeId: string) => {
    if (!hoveredNodeId) return 'normal'
    if (nodeId === hoveredNodeId) return 'highlighted'

    // If hovering a video node, highlight concepts connected to it
    if (hoveredNodeId.startsWith('video_')) {
      const isConnected = linksRef.current.some(l => 
        (l.source === hoveredNodeId && l.target === nodeId) ||
        (l.target === hoveredNodeId && l.source === nodeId)
      )
      return isConnected ? 'highlighted' : 'dimmed'
    }

    // If hovering a concept node, highlight videos covering it
    if (hoveredNodeId.startsWith('concept_')) {
      const isConnected = linksRef.current.some(l => 
        (l.source === nodeId && l.target === hoveredNodeId) ||
        (l.target === nodeId && l.source === hoveredNodeId)
      )
      return isConnected ? 'highlighted' : 'dimmed'
    }

    return 'dimmed'
  }

  const getLinkHighlightState = (link: Link) => {
    if (!hoveredNodeId) return 'normal'
    const matchesSource = link.source === hoveredNodeId
    const matchesTarget = link.target === hoveredNodeId
    return (matchesSource || matchesTarget) ? 'highlighted' : 'dimmed'
  }

  const handleReset = () => {
    const currentNodes = nodesRef.current
    currentNodes.forEach((n, index) => {
      if (n.id === 'query') {
        n.x = width / 2
        n.y = height / 2
      } else {
        const angle = (index / currentNodes.length) * Math.PI * 2
        const radius = n.type === 'video' ? 110 : 200
        n.x = width / 2 + Math.cos(angle) * radius
        n.y = height / 2 + Math.sin(angle) * radius
      }
      n.vx = 0
      n.vy = 0
    })
    setTransform({ x: 0, y: 0, k: 1 })
    setTick(t => t + 1)
  }

  return (
    <div className="border border-[#222222] bg-[#111111]" ref={containerRef}>
      {/* Header Bar */}
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
            className="flex items-center gap-1.5 text-[10px] font-bold text-[#666666] hover:text-white transition-colors uppercase tracking-wider"
            title="Reset layout"
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

      {/* Graph Area */}
      {isOpen && (
        <div className={`relative overflow-hidden bg-black select-none ${isFullscreen ? 'fixed inset-0 z-[300]' : 'h-[450px]'}`}>
          {/* Controls overlaid on graph */}
          <div className="absolute right-4 bottom-4 z-10 flex gap-2">
            <button 
              onClick={() => setIsFullscreen(!isFullscreen)} 
              className="flex h-8 w-8 items-center justify-center border border-[#222222] bg-[#111111]/80 backdrop-blur-sm text-[#cccccc] hover:border-[#444444] hover:text-white transition-all rounded-md"
              title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </button>
          </div>

          <div className="absolute left-4 top-4 z-10 hidden sm:flex items-center gap-4 text-[9px] text-[#555555] font-bold tracking-wider uppercase bg-[#111111]/50 backdrop-blur-sm px-3 py-1.5 rounded border border-[#222222]/30 pointer-events-none">
            <div className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-white" /> Query</div>
            <div className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-[#00f0ff]" /> Videos</div>
            <div className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-[#a855f7]" /> Concepts</div>
            <div className="ml-2 text-[8px] text-[#444444]">Scroll to Zoom • Drag background to Pan • Drag nodes to Arrange</div>
          </div>

          <svg
            ref={svgRef}
            data-tick={tick}
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
                <feGaussianBlur stdDeviation="5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="glow-concept" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Transform Group */}
            <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.k})`}>
              
              {/* 1. Links */}
              {links.map((link, i) => {
                const s = nodesRef.current.find(n => n.id === link.source)
                const t = nodesRef.current.find(n => n.id === link.target)
                if (!s || !t) return null

                const hl = getLinkHighlightState(link)
                let strokeColor = '#222222'
                let strokeWidth = 1
                let opacity = 0.5

                if (hl === 'highlighted') {
                  strokeColor = t.type === 'concept' ? '#a855f7' : '#00f0ff'
                  strokeWidth = 1.8
                  opacity = 0.9
                } else if (hl === 'dimmed') {
                  opacity = 0.08
                }

                return (
                  <line
                    key={`link-${i}`}
                    x1={s.x}
                    y1={s.y}
                    x2={t.x}
                    y2={t.y}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    opacity={opacity}
                    className="transition-all duration-200"
                  />
                )
              })}

              {/* 2. Nodes */}
              {nodes.map(node => {
                const hl = getHighlightState(node.id)
                let opacity = 1
                let stroke = 'transparent'
                let strokeWidth = 0
                let r = node.size

                if (hl === 'highlighted') {
                  opacity = 1
                  stroke = '#ffffff'
                  strokeWidth = 1.5
                  r = node.size * 1.15
                } else if (hl === 'dimmed') {
                  opacity = 0.15
                }

                const filterGlow = node.type === 'video' ? 'url(#glow-video)' : node.type === 'concept' ? 'url(#glow-concept)' : undefined

                return (
                  <g
                    key={node.id}
                    transform={`translate(${node.x}, ${node.y})`}
                    className="transition-all duration-200 cursor-pointer"
                    onMouseDown={(e) => handleNodeMouseDown(e, node)}
                    onTouchStart={(e) => handleNodeTouchStart(e, node)}
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
                    <circle
                      r={r}
                      fill={node.color}
                      stroke={stroke}
                      strokeWidth={strokeWidth}
                      opacity={opacity}
                      filter={filterGlow}
                      className="transition-all duration-200"
                    />
                    
                    {/* Render static query label or concept labels if zoomed in */}
                    {(node.type === 'query' || (node.type === 'concept' && transform.k > 0.85) || hl === 'highlighted') && (
                      <text
                        dy={node.size + 12}
                        textAnchor="middle"
                        fill={node.type === 'query' ? '#ffffff' : '#888888'}
                        className={`text-[8px] font-bold select-none transition-all ${hl === 'highlighted' ? 'fill-white text-[9px]' : ''}`}
                        style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                        opacity={opacity}
                      >
                        {node.type === 'query' ? "TOPIC" : node.label.length > 20 ? node.label.substring(0, 18) + '...' : node.label}
                      </text>
                    )}
                  </g>
                )
              })}
            </g>
          </svg>

          {/* Floating Tooltip HTML Overlay */}
          {hoveredNode && (
            <div
              className="absolute z-20 pointer-events-none rounded-xl border border-[#222222] bg-black/90 backdrop-blur-md px-4 py-3 shadow-2xl animate-fade-in max-w-sm text-left"
              style={{
                left: `${tooltipPos.x}px`,
                top: `${tooltipPos.y}px`
              }}
            >
              {hoveredNode.type === 'query' && (
                <div>
                  <p className="text-[9px] font-bold tracking-widest text-[#555555] uppercase mb-1">Search Topic</p>
                  <p className="text-sm font-semibold text-white leading-relaxed">{hoveredNode.label}</p>
                </div>
              )}

              {hoveredNode.type === 'video' && hoveredNode.originalData && (
                <div className="space-y-1.5">
                  <p className="text-[9px] font-bold tracking-widest text-[#00f0ff] uppercase">Recommended Video</p>
                  <p className="text-xs font-bold text-white line-clamp-2 leading-relaxed">{hoveredNode.originalData.title}</p>
                  <div className="flex items-center justify-between text-[10px] text-[#666666] pt-1">
                    <span>{hoveredNode.originalData.channel}</span>
                    <span className="font-bold text-[#00f0ff]">★ {hoveredNode.originalData.overall_score ? hoveredNode.originalData.overall_score.toFixed(1) : 'N/A'}/10</span>
                  </div>
                  {hoveredNode.originalData.concepts_covered && (
                    <div className="pt-2 border-t border-[#1e1e1e]">
                      <p className="text-[8px] font-bold tracking-wider text-[#555555] uppercase mb-1">Key Concepts</p>
                      <div className="flex flex-wrap gap-1">
                        {hoveredNode.originalData.concepts_covered.slice(0, 3).map(c => (
                          <span key={c} className="text-[9px] px-1.5 py-0.5 bg-[#a855f7]/10 text-[#a855f7] border border-[#a855f7]/20 rounded">
                            {c}
                          </span>
                        ))}
                        {hoveredNode.originalData.concepts_covered.length > 3 && (
                          <span className="text-[8px] text-[#444444] self-center">
                            +{hoveredNode.originalData.concepts_covered.length - 3} more
                          </span>
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
                    Covered by {linksRef.current.filter(l => l.target === hoveredNode.id).length} videos
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
