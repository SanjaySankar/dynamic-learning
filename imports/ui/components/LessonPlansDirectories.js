import React, { Component } from 'react';
import SortableTree, { addNodeUnderParent, removeNodeAtPath } from 'react-sortable-tree';
import { Meteor } from 'meteor/meteor'
import { Tracker } from 'meteor/tracker'
import 'react-sortable-tree/style.css';
import { Directories } from '../../api/directories'
import { LessonPlans } from '../../api/lessonplans'
import { Link } from 'react-router-dom'
import FileExplorerTheme from 'react-sortable-tree-theme-minimal';
 

/*This component displays the lessonplan files in nested tree structure.
    You will be able to create directories and add lessonplans to it.
    Deletion of a directory will result in the deletion of all the directories in it
    along with the lessonplans in all of the nested directories 
    and the main directory.
*/

export default class LessonPlansDirectories extends Component {

  constructor(props) {
    super(props)

    this.state = {
        
      treeData: []
    }

    this.removeOutsideFiles.bind(this)
  }

  componentDidMount() {

      Meteor.subscribe('directories')
      Meteor.subscribe('lessonplans')

      this.directoryTracker = Tracker.autorun(()=>{
        
        const data = Directories.findOne(Meteor.userId())
        const lessonplans = LessonPlans.find().fetch()

        /* Here we fetch two things, all the lessonplans and all directory data */
        
        if(data) {

            const treeData = []       

            /*The treeData is retrieved and the lessonplan objects which are outside the
                file structure is obtained as file objects.
            */

            treeData.push(...data.directories)
            treeData.push(...this.getFileObjects(lessonplans)) 

            this.setState({
                treeData
            })

        }     
    })
  }

  componentWillUnmount() {
    this.directoryTracker.stop()
  }

  getFileObjects(lessonplans) {

    /* If the lessonplan is not added into the file structure yet. It is made into
        an object which contains its _id, title. The resulting array will contain
        null values as elements.
    */

    const structs = lessonplans.map(lessonplan => {

        if(lessonplan.isAdded == false)
            return {
                _id: lessonplan._id,
                title: lessonplan.name,
                isFile: true
            }
        else return null

    })

    /* The null values are filtered out from the array*/

    return structs.filter(struct=>{
        if(struct)
            return struct
    })


  }

  addNewDirectory(e) {   

    e.preventDefault()

    /* New directory is created here.*/

    const newDirectory = {

        title: this.input.value,
        children: [],
        isFile:false
    }

    if(this.input.value) {

        this.setState(prevState => {
            return {
                treeData: prevState.treeData.concat(newDirectory)
            }
        },()=>{
    
            const outSideFilesRemoved = this.removeOutsideFiles()
    
            Meteor.call('directories.update', Meteor.userId(), outSideFilesRemoved)
    
        })
    }   

    this.input.value = ''


  }

  removeOutsideFiles() {

    const {treeData} = this.state

    /* The files which are not yet added to the directory are removed and then
        the database is updated
    */

    return treeData.filter(data => {

        if(typeof data == 'array') {
            return data
        }
        else {
            if(!data.isFile)
                return data
        }
    })

  }

  addNewLessonPlan() {

    if(this.input.value) {

        Meteor.call('lessonplans.insert', this.input.value) 
    }
    this.input.value = ''

  }

  render() {

    const getNodeKey = ({ treeIndex }) => treeIndex;
    
    const canDrop = ({ node, nextParent, prevPath, nextPath }) => {

        /* To prevent a file to be added as a child of a file 
            and to prevent a directory to be added as a child of a file.
        */
  
        if (node.isFile && nextParent && nextParent.isFile) {
          return false;
        }
  
        if (!node.isFile && nextParent && nextParent.isFile) {
            return false;
        }
  
        return true;
    }

    const removeLessonPlan = node => {

        /* The deletion takes place recursively.
            If the node is a file, using the id in it, it is removed
            from the database.

            If the node has no children, returned otherwise
            we recursively move to the children nodes.
        */

        if(node.isFile) {

            Meteor.call('lessonplans.remove', node._id)
            return
            
        }

        if(node.children.length == 0) {
            return
        }
        else {
            node.children.map(child => {
                removeLessonPlan(child)
            })
        }        

    }

    return (
        

      <div style={{ height: 400 }}>

            <input ref = {e => this.input = e}/>

            <button

                onClick = {this.addNewLessonPlan.bind(this)} 
                style = {{marginLeft:'1.6rem'}} 
                className = 'button'>
                
                New LessonPlan

            </button>

            <button 

                onClick = {this.addNewDirectory.bind(this)} 
                style = {{marginLeft:'1.6rem'}} 
                className = 'button'>
                
                New directory

            </button>

        <SortableTree

            theme={FileExplorerTheme}
            
            canDrop={canDrop}

            treeData={this.state.treeData}

            onChange={treeData => this.setState({ treeData })}

            onMoveNode = { args => {

                    if(args.node.isFile) {

                        /*When a file is moved within the directory structure, we check
                            whether it has come to the root directory. If args.nextParentNode
                            is null, it is outsude, otherwise it is inside.
                        */

                        if(args.nextParentNode) {

                            Meteor.call('lessonplans.directoryChange', args.node._id, true)
                        }
                        else {

                            Meteor.call('lessonplans.directoryChange', args.node._id, false)
                        }
                    }
                    
                    const outSideFilesRemoved = this.removeOutsideFiles()

                    Meteor.call('directories.update', Meteor.userId(), outSideFilesRemoved)               
                }             
            }

            generateNodeProps={({ node, path }) => ({
                buttons: [

                  <button
                  className = 'button-nested'
                    style = {{visibility:node.isFile?'visible':'hidden'}}>
                    <Link to ={{ pathname: `/createlessonplan/${node._id}`}}>
                        Open
                    </Link>
                  </button>,

                  <button
                    className = 'button-nested'
                    onClick={() =>{

                      const input = confirm('Are you sure you want to perform this deletion?')
                      if(!input)
                        return

                      if(!node.isFile) {
                        removeLessonPlan(node)
                      }
                      else {

                        Meteor.call('lessonplans.remove', node._id)
                      }
                        
                      this.setState(state => ({                          
                        treeData: removeNodeAtPath({
                          treeData: state.treeData,
                          path,
                          getNodeKey,
                        }),
                      }),()=>{

                        const outSideFilesRemoved = this.removeOutsideFiles()
                
                        Meteor.call('directories.update', Meteor.userId(), outSideFilesRemoved)

                      })}
                    }
                  >
                    Remove
                  </button>
                ]
              })}
        />
      </div>
    );
  }
}