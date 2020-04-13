interface Validatable {
  value: string|number;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
}

// Drag and Drop interfaces
interface Draggable {
  dragStartHandler (e: DragEvent): void;
  dragEndHandler (e: DragEvent): void;
}

interface DragTarget {
  dragOverHandler (e: DragEvent): void;
  dragHandler (e: DragEvent): void;
  dragLeaveHandler (e: DragEvent): void;
}

enum ProjectStatus {
  Active,
  Finished
};

class Project {
  constructor (
    public id: string,
    public title: string,
    public desc: string,
    public people: number,
    public status: ProjectStatus
  ) {
    
  }
}

type Listener<T> = (projects: T[]) => void;

class State<T> {
  protected listeners: Listener<T>[] = []
  
   addListener (fn:Listener<T>) {
    this.listeners.push(fn);
  }
}

class ProjectState extends State<Project> {
  private projects: Project[] = [];
  private static instance: ProjectState;

  constructor () {
    super();
  }

  addProject (title:string, desc:string, people:number) {
    this.projects.push(new Project(Math.random().toString(), title, desc, people, ProjectStatus.Active));

    this.updateListeners();
  }

  moveProject (projectId: string, newStatus: ProjectStatus) {
    const project = this.projects.find(prj => prj.id === projectId);

    if (project && project.status !== newStatus) {
      project.status = newStatus;

      this.updateListeners();
    }
  }

  updateListeners () {
    this.listeners.forEach(fn => fn([...this.projects]));
  }

  static getInstance () {
    if (this.instance) {
      return this.instance;
    }

    this.instance = new ProjectState();
    return this.instance;
  }
}

const projectState = ProjectState.getInstance();

// const validate = (data:Validatable):boolean => {
function validate (data:Validatable):boolean {
  let isValid = true;

  if (data.required) {
    isValid = isValid && data.value.toString().trim().length !== 0;
  }

  if (data.minLength != null && typeof data.value === 'string') {
    isValid = isValid && data.value.trim().length >= data.minLength;
  }

  if (data.maxLength != null && typeof data.value === 'string') {
    isValid = isValid && data.value.trim().length <= data.maxLength;
  }

  if (data.min != null && typeof data.value === 'number') {
    isValid = isValid && data.value >= data.min;
  }

  if (data.max != null && typeof data.value === 'number') {
    isValid = isValid && data.value <= data.max;
  }

  return isValid;
}

function Autobind (_:any, _2:string, descriptor:PropertyDescriptor): PropertyDescriptor {
  const originalMethod = descriptor.value;

  return {
    configurable: true,
    get () {
      const boundFn = originalMethod.bind(this);
      return boundFn
    }
  }
};

abstract class Component<T extends HTMLElement, U extends HTMLElement> {
  templateElement: HTMLTemplateElement;
  hostElement: T;
  element: U;
  
  constructor (
    templateId: string,
    hostElementId: string,
    insertAtStart: boolean,
    newElementId?: string
  ) {
    this.templateElement = <HTMLTemplateElement>document.getElementById(templateId)!;
    this.hostElement = <T>document.getElementById(hostElementId)!;

    const importedNode = document.importNode(this.templateElement.content, true);
    this.element = <U>importedNode.firstElementChild;
    if (newElementId) this.element.id = newElementId;

    this.attach(insertAtStart);
  }

  private attach (insertAtBeginning: boolean) {
    this.hostElement.insertAdjacentElement(
      insertAtBeginning ? 'afterbegin' : 'beforeend',
      this.element
    );
  }

  abstract configure ():void;
  abstract renderContent ():void;
}

class ProjectItem extends Component<HTMLUListElement, HTMLLIElement> implements Draggable  {
  private project: Project;

  get persons () {
    return `${this.project.people} ${this.project.people === 1 ? 'person' : 'people'}`;
  }

  constructor (hostId: string, project: Project) {
    super('single-project', hostId, false, project.id);

    this.project = project;

    this.configure();
    this.renderContent();
  }

  configure () {
    this.element.addEventListener('dragstart', this.dragStartHandler);
    this.element.addEventListener('dragend', this.dragEndHandler);
  }

  @Autobind
  dragStartHandler (e: DragEvent) {
    e.dataTransfer!.setData('text/plain', this.project.id);
    e.dataTransfer!.effectAllowed = 'move';
  }

  dragEndHandler (_: DragEvent) {
    // console.log('Drag End', e);
  }

  renderContent () {
    this.element.querySelector('h2')!.textContent = this.project.title;
    this.element.querySelector('h3')!.textContent = `${this.persons} assigned`;
    this.element.querySelector('p')!.textContent = this.project.desc;
  }
}

class ProjectList extends Component<HTMLDivElement, HTMLElement> implements DragTarget {
  assignedProjects: Project[];

  constructor (private type: 'active' | 'finished') {
    super(
      'project-list',
      'app',
      false,
      `${type}-projects`
    );

    this.assignedProjects = [];
    
    this.configure();
    this.renderContent();
  }

  configure () {
    this.element.addEventListener('dragover', this.dragOverHandler);
    this.element.addEventListener('dragleave', this.dragLeaveHandler);
    this.element.addEventListener('drop', this.dragHandler);

    projectState.addListener((projects: Project[]) => {
      const relevantProjects = projects.filter(prj => {
        if (this.type === 'active') {
          return prj.status === ProjectStatus.Active;
        }

        return prj.status === ProjectStatus.Finished;
      })
      this.assignedProjects = relevantProjects;
      this.renderProjects();
    });
  }

  @Autobind
  dragOverHandler (e: DragEvent) {
    if (e.dataTransfer && e.dataTransfer.types[0] === 'text/plain') {
      e.preventDefault();

      const listEl = this.element.querySelector('ul')!;
      listEl.classList.add('droppable');
    }
  }

  @Autobind
  dragHandler (e: DragEvent) {
    e.preventDefault();

    const prjId = e.dataTransfer!.getData('text/plain');
    projectState.moveProject(prjId, this.type === 'active' ? ProjectStatus.Active : ProjectStatus.Finished);
  }

  @Autobind
  dragLeaveHandler (_: DragEvent) {
    const listEl = this.element.querySelector('ul')!;
    listEl.classList.remove('droppable');
  }

  renderContent () {
    const listId = `${this.type}-projects-list`;
    this.element.querySelector('ul')!.id = listId;
    this.element.querySelector('h2')!.textContent = `${this.type.toUpperCase()} PROJECTS`;
  }

  private renderProjects () {
    const listEl = <HTMLUListElement>document.getElementById(`${this.type}-projects-list`)!;
    listEl.innerHTML = '';

    this.assignedProjects.forEach(prj => {
      new ProjectItem(this.element.querySelector('ul')!.id, prj);
    });
  }
}

class ProjectInput extends Component<HTMLDivElement, HTMLFormElement> {
  titleInputElement:HTMLInputElement;
  descriptionInputElement:HTMLInputElement;
  peopleInputElement:HTMLInputElement;

  constructor () {
    super(
      'project-input',
      'app',
      true,
      'user-input'
    );

    this.titleInputElement = <HTMLInputElement>this.element.querySelector('#title');
    this.descriptionInputElement = <HTMLInputElement>this.element.querySelector('#description');
    this.peopleInputElement = <HTMLInputElement>this.element.querySelector('#people');
    
    this.configure();
  }

  configure () {
    this.element.addEventListener('submit', this.submitHandler);
  }

  renderContent () {}

  private clearInputs () {
    this.titleInputElement.value = '';
    this.descriptionInputElement.value = '';
    this.peopleInputElement.value = '';
  }

  private gatherUserInput ():[string, string, number] | void {
    const enteredTitle = this.titleInputElement.value;
    const enteredDescription = this.descriptionInputElement.value;
    const enteredPeople = this.peopleInputElement.value;

    const titleValidatable: Validatable = {
      value: enteredTitle,
      required: true,
      minLength: 5,
      maxLength: 40
    };

    const descValidatable: Validatable = {
      value: enteredDescription,
      required: true,
      maxLength: 140
    };

    const peopleValidatable: Validatable = {
      value: +enteredPeople,
      required: true,
      min: 1,
      max: 10
    };

    if (
      validate(titleValidatable) &&
      validate(descValidatable) &&
      validate(peopleValidatable)
    ) {
      return [enteredTitle, enteredDescription, +enteredPeople];
    } else {
      alert('invalid input, please try again!');
      return;
    }
  }

  @Autobind
  private submitHandler (e:Event) {
    e.preventDefault();

    const userInput = this.gatherUserInput();

    if (Array.isArray(userInput)) {
      const [title, desc, people] = userInput;
      projectState.addProject(title, desc, people);

      this.clearInputs();
    }
  }
}

const prjInput = new ProjectInput();
const activePrjList = new ProjectList('active');
const finishedPrjList = new ProjectList('finished');
