export interface IamModule {
  id: number;
  name: string;
  code: string;
}

export interface IamSalle {
  id: number;
  name: string;
  capacity: number;
  modules: IamModule[];
}

export interface IamSite {
  id: number;
  name: string;
  code: string;
  address: string;
  location: string;
  salles: IamSalle[];
}
