import React, { useState, useCallback } from 'react';
import ReactFlow, { 
  addEdge, 
  Background, 
  Controls, 
  MiniMap,
  applyEdgeChanges,
  applyNodeChanges,
  Handle,
  Position
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Share2, Plus, Play, Download } from 'lucide-react';

// Nodos con conectores (Handles)
const CustomNode = ({ data, selected }) => (
  <div style={{ 
    padding: '15px', 
    borderRadius: '8px', 
    background: data.background || '#3b82f6', 
    color: '#fff', 
    border: selected ? '2px solid #fff' : 'none',
    minWidth: '150px',
    textAlign: 'center',
    fontWeight: 'bold',
    boxShadow: '0 4px 6px rgba(0,0,0,0.2)'
  }}>
    <Handle type="target" position={Position.Top} style={{ background: '#fff' }} />
    {data.label}
    <Handle type="source" position={Position.Bottom} style={{ background: '#fff' }} />
  </div>
);

const DiamondNode = ({ data, selected }) => (
  <div style={{ 
    width: '120px', 
    height: '120px', 
    background: '#f59e0b', 
    transform: 'rotate(45deg)', 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center',
    border: selected ? '2px solid #fff' : '2px solid #d97706',
    borderRadius: '8px'
  }}>
    <Handle type="target" position={Position.Top} style={{ transform: 'rotate(-45deg)', background: '#fff' }} />
    <div style={{ transform: 'rotate(-45deg)', color: 'white', textAlign: 'center', fontSize: '0.9rem', fontWeight: 'bold' }}>
      {data.label}
    </div>
    <Handle type="source" position={Position.Bottom} style={{ transform: 'rotate(-45deg)', background: '#fff' }} />
  </div>
);

const nodeTypes = {
  custom: CustomNode,
  decision: DiamondNode,
};

const initialNodes = [
  { 
    id: 'node_start', 
    type: 'custom', 
    data: { label: 'INICIO: Escribe aquí', background: '#10b981' }, 
    position: { x: 250, y: 50 } 
  },
];

const App = () => {
  const [nodes, setNodes] = useState(initialNodes);
  const [edges, setEdges] = useState([]);

  const onNodesChange = useCallback((changes) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
  const onEdgesChange = useCallback((changes) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);
  const onConnect = useCallback((params) => setEdges((eds) => addEdge(params, eds)), []);

  const onNodeDoubleClick = (event, node) => {
    const newText = prompt('Nuevo texto:', node.data.label);
    if (newText) {
      setNodes((nds) => nds.map((n) => n.id === node.id ? { ...n, data: { ...n.data, label: newText } } : n));
    }
  };

  const onEdgeDoubleClick = (event, edge) => {
    const newText = prompt('Texto para la flecha:', edge.label || '');
    if (newText !== null) {
      setEdges((eds) => eds.map((e) => e.id === edge.id ? { ...e, label: newText, labelStyle: { fill: '#fff', fontWeight: 'bold' }, labelBgStyle: { fill: '#1e293b' } } : e));
    }
  };

  const addNode = (type) => {
    const id = `node_${Date.now()}`;
    const newNode = {
      id,
      type: type === 'Decisión' ? 'decision' : 'custom',
      data: { 
        label: `Nueva ${type}`, 
        background: type === 'Proceso' ? '#3b82f6' : type === 'Fin' ? '#ef4444' : undefined 
      },
      position: { x: 300, y: 200 }
    };
    setNodes((nds) => nds.concat(newNode));
  };

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', background: '#0f172a', color: '#f8fafc', fontFamily: 'Arial' }}>
      <div style={{ padding: '15px', background: '#1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <h1 style={{ color: '#60a5fa', margin: 0, fontSize: '1.2rem' }}>FLOWMASTER v4</h1>
          <button onClick={() => addNode('Proceso')} style={btnStyle}>+ Proceso</button>
          <button onClick={() => addNode('Decisión')} style={btnStyle}>+ Decisión</button>
          <button onClick={() => addNode('Fin')} style={btnStyle}>+ Fin</button>
          <button onClick={() => {
            navigator.clipboard.writeText(JSON.stringify({ nodes, edges }));
            alert('¡Copiado!');
          }} style={{ ...btnStyle, background: '#3b82f6', fontWeight: 'bold' }}>EXPORTAR PARA IA</button>
        </div>
      </div>
      <div style={{ flex: 1 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDoubleClick={onNodeDoubleClick}
          onEdgeDoubleClick={onEdgeDoubleClick}
          nodeTypes={nodeTypes}
          fitView
        >
          <Background color="#334155" />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
};

const btnStyle = { background: '#334155', border: 'none', color: '#fff', padding: '10px 15px', borderRadius: '5px', cursor: 'pointer' };

export default App;
