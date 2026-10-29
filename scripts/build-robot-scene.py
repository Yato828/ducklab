#!/usr/bin/env python3
"""Generate DUCKLAB environment around unchanged official robot dynamics."""
import pathlib, json, sys, xml.etree.ElementTree as ET
suffix="_rollers" if "--rollers" in sys.argv else ""
root_dir=pathlib.Path(__file__).resolve().parents[1]
path=root_dir/'apps/web/public/robot/mjlab'
tree=ET.parse(path/f'robot_allcollisions{suffix}.xml');root=tree.getroot()
# These geoms are visual only (contype=conaffinity=0), inertias are explicit.
for parent in root.iter():
 for child in list(parent):
  if child.tag=='geom' and child.get('class')=='visual':parent.remove(child)
used={g.get('mesh') for g in root.iter('geom') if g.get('mesh')}
asset=root.find('asset')
for m in list(asset.findall('mesh')):
 if m.get('name',pathlib.Path(m.get('file')).stem) not in used:asset.remove(m)
ET.SubElement(root,'option',timestep='0.005',gravity='0 0 -9.81')
world=root.find('worldbody');ET.SubElement(world,'geom',name='floor',type='plane',size='0 0 0.05',pos='0 0 0',friction='1 0.005 0.0001')
# Real physical objects: one sphere, one light cube, one wedge. Objects park off-scene until requested.
ET.SubElement(asset,'mesh',name='ducklab_ramp',vertex='-.16 -.12 0 .16 -.12 0 .16 .12 0 -.16 .12 0 .16 -.12 .08 .16 .12 .08',face='0 1 2 0 2 3 0 4 1 3 2 5 0 3 5 0 5 4 1 4 5 1 5 2')
objects=[('ball','sphere','0.04','0.03'),('block','box','0.045 0.045 0.045','0.10'),('ramp','mesh',None,'2.0')]
for i,(name,kind,size,mass) in enumerate(objects):
 b=ET.SubElement(world,'body',name='ducklab_'+name,pos=f'{10+i*2} 0 0.1');ET.SubElement(b,'freejoint',name='ducklab_'+name+'_free')
 a=dict(name='ducklab_'+name+'_geom',type=kind,mass=mass,friction='0.7 0.01 0.003',condim='6')
 if size:a['size']=size
 else:a['mesh']='ducklab_ramp'
 if kind=='sphere':a['solref']='0.03 0.4'
 ET.SubElement(b,'geom',a)
k=json.load(open(path/'kinematics.json'));names=[x.get('joint') for x in root.find('actuator')]
# Official default pose copied from pinned constants.js; verified against RL scene_walk.xml.
pose=[0,-0.08726646259971647,-0.457924,-0.004940,0.452984,0.3490658503988659,0.3490658503988659,0,0,0,0.08726646259971647,0.457924,0.004940,-0.452984]
pose_by=dict(zip(names,pose));q=[0,0,.12,1,0,0,0]+[pose_by.get(j.get('name'),0) for j in root.findall('.//body/joint')]
for i in range(3):q.extend([10+i*2,0,.1,1,0,0,0])
kf=ET.SubElement(root,'keyframe');ET.SubElement(kf,'key',name='STAND',qpos=' '.join(map(str,q)),ctrl=' '.join(map(str,pose)))
tree.write(path/f'scene_ducklab{suffix}.xml',encoding='utf-8',xml_declaration=True)
mesh_files=[m.get('file') for m in asset.findall('mesh') if m.get('file')]
(path/f'physics-assets{suffix}.json').write_text(json.dumps(dict(meshFiles=mesh_files,jointNames=names,timestep=.005,decimation=4,policyHz=50,observationSize=61,actionSize=14),indent=2))
print('Generated scene;',len(mesh_files),'original collision meshes;',len(names),'actuators;',len(q),'qpos values')
