/*!
 * recast.js
 * https://github.com/vincent/recast.js
 *
 * Copyright 2014 Vincent Lark
 * Released under the MIT license
 */
/*jshint onevar: false, indent:4 */
/*global exports: true, require: true, THREE: true, Stats: true */
'use strict';

var renderer = new THREE.WebGLRenderer({antialias: true});
renderer.setSize(document.body.clientWidth * 0.6, document.body.clientHeight * 0.8);
renderer.domElement.style.position = 'absolute';
renderer.domElement.style.bottom = 0;
renderer.domElement.style.right = 0;
document.body.appendChild(renderer.domElement);
renderer.setClearColorHex(0xFFFFFF, 1.0);
renderer.clear();

var width = renderer.domElement.width;
var height = renderer.domElement.height;
var camera = new THREE.PerspectiveCamera( 45, width / height, 1, 10000);
camera.position.y = 50;
camera.position.z = 50;

var controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.addEventListener('change', function(){
    render();
});

var agentsParam = location.search.match(/agents=(\d+)/);
var MAX_AGENTS = (agentsParam && agentsParam.length == 2 ) ? agentsParam[1] : 10;
var MAX_HOPS = 10;

var agentsObjects = [];
var scene = new THREE.Scene();

var agentGeometry = new THREE.CylinderGeometry(0.2, 0.5, 2);
var agentMaterial = new THREE.MeshBasicMaterial({
  color: '#FF0000'
});

for (var i = 0; i < MAX_AGENTS; i++) {
    var agent = new THREE.Object3D();
    var agentBody = new THREE.Mesh(agentGeometry, agentMaterial);
    agentBody.position.y = 1;
    agent.add(agentBody);

    agentsObjects.push(agent);
    scene.add(agent);
}

var light = new THREE.SpotLight();
light.position.set( 170, 330, -160 );
scene.add(light);

var navigationMesh, sequence;

////////////////////////////////

var terrain, agents = [];
var debugDraw = {};
var recast = require('../lib/recast');

recast.setGLContext(renderer.context);

function render () {
    renderer.render(scene, camera);

    if (debugDraw.NavMesh)              { recast.drawObject('NavMesh');             }                        
    if (debugDraw.NavMeshPortals)       { recast.drawObject('NavMeshPortals');      }          
    if (debugDraw.RegionConnections)    { recast.drawObject('RegionConnections');   }    
    if (debugDraw.RawContours)          { recast.drawObject('RawContours');         }                
    if (debugDraw.Contours)             { recast.drawObject('Contours');            }                      
    if (debugDraw.HeightfieldSolid)     { recast.drawObject('HeightfieldSolid');    }      
    if (debugDraw.HeightfieldWalkable)  { recast.drawObject('HeightfieldWalkable'); }
}

// Check our library is here
exports['recast is present'] = function(test) {
    test.ok(recast, 'recast should be an object');
    test.done();
};

// Check our methods are here
exports['our methods are present'] = function(test) {
    test.ok(recast.set_cellSize, 'set_cellSize');
    test.ok(recast.set_cellHeight, 'set_cellHeight');
    test.ok(recast.set_agentHeight, 'set_agentHeight');
    test.ok(recast.set_agentRadius, 'set_agentRadius');
    test.ok(recast.set_agentMaxClimb, 'set_agentMaxClimb');
    test.ok(recast.set_agentMaxSlope, 'set_agentMaxSlope');

    test.ok(recast.build, 'build');
    test.ok(recast.initCrowd, 'initCrowd');
    test.ok(recast.initWithFileContent, 'initWithFileContent');
    test.ok(recast.findNearestPoint, 'findNearestPoint');
    test.ok(recast.findPath, 'findPath');
    test.ok(recast.getRandomPoint, 'getRandomPoint');

    test.ok(recast.addCrowdAgent, 'addCrowdAgent');
    test.ok(recast.updateCrowdAgentParameters, 'updateCrowdAgentParameters');
    test.ok(recast.requestMoveVelocity, 'requestMoveVelocity');
    test.ok(recast.removeCrowdAgent, 'removeCrowdAgent');
    test.ok(recast.crowdRequestMoveTarget, 'crowdRequestMoveTarget');
    test.ok(recast.crowdUpdate, 'crowdUpdate');
    test.ok(recast.crowdGetActiveAgents, 'crowdGetActiveAgents');
    test.done();
};

// Check file loading
exports['handle an agent'] = function(test) {
    test.expect(11);

    recast.set_cellSize(0.3);
    recast.set_cellHeight(0.8);
    recast.set_agentHeight(1.0);
    recast.set_agentRadius(0.2);
    recast.set_agentMaxClimb(4.0);
    recast.set_agentMaxSlope(30.0);

    /*
    recast.settings({
        cellSize: 2.0,
        cellHeight: 1.5,
        agentHeight: 2.0,
        agentRadius: 0.2,
        agentMaxClimb: 4.0,
        agentMaxSlope: 30.0
    });
    */


    var stats = new Stats();
    stats.setMode(1); // 0: fps, 1: ms
    stats.domElement.style.position = 'absolute';
    stats.domElement.style.right = '0px';
    stats.domElement.style.bottom = '0px';
    document.body.appendChild( stats.domElement );
    stats.setMode(0);
    stats.begin();

   
    var loader = new THREE.OBJLoader();
    loader.load('nav_test.obj', function(object){
        terrain = object;
        object.traverse(function(child) {
            if (child instanceof THREE.Mesh) {
                child.material.side = THREE.DoubleSide;
            }
        } );
        scene.add(object);
    });


    /**
     * Load an .OBJ file
     */
    recast.OBJLoader('nav_test.obj', function(){

        // recast.debugCreateNavMesh(0);
        // recast.debugCreateNavMeshPortals();
        // recast.debugCreateRegionConnections();
        // recast.debugCreateRawContours();
        // recast.debugCreateContours();
        // recast.debugCreateHeightfieldSolid();
        // recast.debugCreateHeightfieldWalkable();

        /**
         * Get navmesh geometry and draw it
         */
        if (location.search.match(/navigationmesh=1/)) {
            recast.getNavMeshVertices(recast.cb(function (vertices) {

                navigationMesh = new THREE.Object3D();
                var materials = [ new THREE.MeshNormalMaterial() ];

                for (var i = 0; i < vertices.length; i++) {
                    if (!vertices[i+2]) { break; }

                    var geometry = new THREE.ConvexGeometry([
                        new THREE.Vector3(   vertices[i].x,   vertices[i].y,   vertices[i].z ), 
                        new THREE.Vector3( vertices[i+1].x, vertices[i+1].y, vertices[i+1].z ),
                        new THREE.Vector3( vertices[i+2].x, vertices[i+2].y, vertices[i+2].z )
                    ]);

                    var child = THREE.SceneUtils.createMultiMaterialObject(geometry, materials);
                    navigationMesh.add(child);

                    i += 2;
                }

                // scene.add(navigationMesh);

                // renderer.render(scene, camera);
            }));
        }

        recast.vent.on('update', function (agents) {
            for (var i = 0; i < agents.length; i++) {
                var pos = agents[i].position;
                agentsObjects[i].position.set(pos.x, pos.y, pos.z);
            }
        });

        /**
         * Add some agents
         */
        for (var i = 0; i < agentsObjects.length; i++) {
            agents.push(recast.addAgent({
                position: {
                    x: -25.8850,
                    y: -1.64166,
                    z: -5.41350
                },
                radius: 0.8,
                height: 0.5,
                maxAcceleration: 1.0,
                maxSpeed: 2.0,
                updateFlags: 0,
                separationWeight: 20.0
            }));
        }

        var routes;

        var last = new Date().getTime();
        var animate = function animate (time) {
            window.requestAnimationFrame(animate);

            recast.crowdUpdate(0.1);
            recast.crowdGetActiveAgents();

            last = time;
            render();

            if (stats) stats.update();
        };

        animate(new Date().getTime());

        sequence = function() {
            document.getElementById('sequence').style.display = 'none';
            routes = 0;
            goAway();
        };

        var goAway = function(){
            for (var i = 0; i < agentsObjects.length; i++) {
                (function (i) {
                    recast.getRandomPoint(recast.cb(function(pt2x, pt2y, pt2z){
                        recast.crowdRequestMoveTarget(i, pt2x, pt2y, pt2z);
                        if (++routes < MAX_HOPS) {
                            test.ok(true, 'route ' + routes + ': to ' + Math.round(pt2x, 2) + ',' + Math.round(pt2y, 2)+ ',' + Math.round(pt2z, 2));
                            setTimeout(goAway, 8000 * Math.random());
                        } else {
                            document.getElementById('sequence').style.display = 'block';
                            // test.done();
                        }
                    }));
                })(i);
            }
        };

        sequence();
    });
};
